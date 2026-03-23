/**
 * StoreScreen — single entry for browsing and managing extensions.
 *
 * Layout:
 * - Level 1: Explore | Installed
 * - Level 2 inside Explore: MCP | Skills
 * - Management actions stay inside Store via sheets/modals
 */
import * as DocumentPicker from 'expo-document-picker';
import {
  Box,
  Check,
  ChevronRight,
  Download,
  FileArchive,
  Github,
  Link as LinkIcon,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image as RNImage,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BuiltinSkillIcon } from '../components/ui/BuiltinSkillIcon';
import CardSkeleton from '../components/ui/CardSkeleton';
import { FilterChip, MetaTag, SegmentedControl } from '../components/ui/ChoiceControls';
import EmptyState from '../components/ui/EmptyState';
import PressableScale from '../components/ui/PressableScale';
import { HeaderIconButton, ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { useToast } from '../components/ui/Toast';
import {
  MOBILE_RECOMMENDED_BUILTIN_SKILLS,
  type MobileRecommendedBuiltinIcon,
} from '../constants/recommendedBuiltins';
import {
  ALL_CATEGORY_KEY,
  FALLBACK_MCP_CATEGORY_KEYS,
  FALLBACK_SKILL_CATEGORY_KEYS,
  getCategoryLabel,
  normalizeCategoryKey,
} from '../constants/storeCategories';
import {
  agentSkillApi,
  fileApi,
  type MarketCategoryItem,
  type MarketListItem,
  marketSkillApi,
  mcpApi,
  pluginApi,
  userApi,
} from '../lib/api';
import { useMainTabScrollableContentPaddingBottom } from '../lib/bottomChrome';
import { haptics } from '../lib/haptics';
import { type I18nStore, type Locale, useI18n } from '../lib/i18n';
import { type ColorTokens, useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { AgentSkillItem, InstalledPlugin } from '../types';

type ExploreSource = 'mcp' | 'skill';
type StoreTab = 'explore' | 'installed';

const MARKET_PAGE_SIZE = 21;

const getValidCategoryKeys = (source: ExploreSource) =>
  source === 'mcp' ? [...FALLBACK_MCP_CATEGORY_KEYS] : [...FALLBACK_SKILL_CATEGORY_KEYS];

interface StoreInstalledItem {
  avatar?: string;
  badgeBackgroundColor: string;
  badgeColor: string;
  builtinIcon?: MobileRecommendedBuiltinIcon;
  description?: string;
  id: string;
  identifier: string;
  kind: 'builtin' | 'plugin' | 'skill';
  label: string;
  name: string;
}

type InstalledKindFilter = 'all' | StoreInstalledItem['kind'];

interface SelectedStoreEntry {
  item: MarketListItem | StoreInstalledItem;
  source: 'installed' | 'market';
}

interface StoreDetailItem {
  author?: string;
  avatar?: string;
  builtinItem?: StoreInstalledItem | null;
  description?: string;
  identifier: string;
  installedPlugin?: InstalledPlugin | null;
  installedSkill?: AgentSkillItem | null;
  label: string;
  marketItem?: MarketListItem;
  name: string;
}

interface InstalledFetchOptions {
  silent?: boolean;
}

const isEmojiAvatar = (avatar?: string) =>
  avatar && avatar.length <= 4 && /\p{Extended_Pictographic}/u.test(avatar);

const getSkillAvatar = (skill: AgentSkillItem) => {
  const manifest = skill.manifest as Record<string, any> | undefined;
  return manifest?.meta?.avatar || manifest?.avatar || manifest?.icon;
};

const getSkillDescription = (skill: AgentSkillItem) => {
  const manifest = skill.manifest as Record<string, any> | undefined;
  return skill.description || manifest?.meta?.description || manifest?.description;
};

/** Format large counts for display (e.g. 12345 → "1.2万" / "12.3k") */
const formatCount = (n: number, locale: Locale): string => {
  if (n >= 10000) {
    const wan = n / 10000;
    if (locale.startsWith('zh')) {
      return wan >= 10
        ? `${Math.floor(wan)}万`
        : wan % 1 === 0
          ? `${wan}万`
          : `${wan.toFixed(1)}万`;
    }
    return `${(n / 1000).toFixed(1)}k`;
  }
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
};

const deriveCategoriesFromItems = (
  items: MarketListItem[],
  _source: ExploreSource,
): MarketCategoryItem[] => {
  const countByCategory = new Map<string, number>();
  for (const item of items) {
    const raw = item.category?.trim().toLowerCase();
    if (!raw) continue;
    countByCategory.set(raw, (countByCategory.get(raw) ?? 0) + 1);
  }
  return Array.from(countByCategory.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
};

const buildCategoryOptions = (
  categories: MarketCategoryItem[],
  source: ExploreSource,
  locale: Locale,
): Array<{ count?: number; key: string; label: string }> => {
  const validKeys = getValidCategoryKeys(source);
  const categoryMap = new Map<string, { count?: number; key: string; label: string }>();

  for (const item of categories) {
    const rawKey = item?.category?.trim().toLowerCase();
    if (!rawKey) continue;

    const labelKey = normalizeCategoryKey(rawKey, validKeys) || rawKey;
    const current = categoryMap.get(rawKey);
    const nextCount = (item.count ?? 0) + (current?.count ?? 0);

    categoryMap.set(rawKey, {
      count: nextCount || undefined,
      key: rawKey,
      label:
        current?.label ||
        getCategoryLabel(labelKey, locale) ||
        item.name ||
        item.description ||
        rawKey,
    });
  }

  const normalized = [...categoryMap.values()].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));

  const totalCount = normalized.reduce((sum, item) => sum + (item.count ?? 0), 0);

  return [
    {
      count: totalCount || undefined,
      key: ALL_CATEGORY_KEY,
      label: getCategoryLabel(ALL_CATEGORY_KEY, locale),
    },
    ...normalized,
  ];
};

const mergeCategoryBuckets = (
  categories: MarketCategoryItem[],
  _source: ExploreSource,
): MarketCategoryItem[] => {
  const categoryMap = new Map<string, MarketCategoryItem>();

  for (const item of categories) {
    const rawCategory = item?.category?.trim().toLowerCase();
    if (!rawCategory) continue;
    const current = categoryMap.get(rawCategory);
    categoryMap.set(rawCategory, {
      category: rawCategory,
      count: (item.count ?? 0) + (current?.count ?? 0),
      description: current?.description ?? item.description,
      name: current?.name ?? item.name,
    });
  }

  return [...categoryMap.values()].sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
};

const mergeSkillLists = (...groups: AgentSkillItem[][]): AgentSkillItem[] => {
  const map = new Map<string, AgentSkillItem>();

  for (const group of groups) {
    for (const skill of group) {
      const key = skill.identifier || skill.id;
      if (!key) continue;
      map.set(key, skill);
    }
  }

  return [...map.values()];
};

const mergeMarketItems = (items: MarketListItem[]) => {
  const map = new Map<string, MarketListItem>();

  for (const item of items) {
    map.set(item.identifier, item);
  }

  return [...map.values()];
};

const buildInstalledPluginItem = (
  plugin: InstalledPlugin,
  t: I18nStore['t'],
  colors: Pick<
    ColorTokens,
    | 'primary'
    | 'fillTertiary'
    | 'secondaryText'
    | 'muted'
    | 'danger'
    | 'foreground'
    | 'sourceBuiltin'
    | 'sourceBuiltinMuted'
    | 'sourceCustom'
    | 'sourceCustomMuted'
    | 'sourceMarketMuted'
  >,
): StoreInstalledItem => {
  const isCustom = plugin.type === 'customPlugin';
  const name = plugin.manifest?.meta?.title || plugin.customParams?.name || plugin.identifier;
  const description =
    plugin.manifest?.meta?.description ||
    plugin.customParams?.description ||
    plugin.customParams?.manifestUrl;
  const avatar = plugin.manifest?.meta?.avatar || plugin.customParams?.avatar;

  return {
    avatar,
    badgeBackgroundColor: isCustom ? colors.sourceCustomMuted : colors.sourceMarketMuted,
    badgeColor: isCustom ? colors.sourceCustom : colors.primary,
    description,
    id: plugin.identifier,
    identifier: plugin.identifier,
    kind: 'plugin',
    label: isCustom ? t.storeCustom : t.storeMcp,
    name,
  };
};

const buildInstalledSkillItem = (
  skill: AgentSkillItem,
  t: I18nStore['t'],
  colors: Pick<
    ColorTokens,
    | 'primary'
    | 'fillTertiary'
    | 'secondaryText'
    | 'muted'
    | 'danger'
    | 'foreground'
    | 'sourceBuiltin'
    | 'sourceBuiltinMuted'
    | 'sourceCustom'
    | 'sourceCustomMuted'
    | 'sourceMarketMuted'
  >,
): StoreInstalledItem => {
  const source = skill.source || 'user';
  const label =
    source === 'builtin'
      ? t.storeBuiltIn
      : source === 'market'
        ? t.storeFromStore
        : t.storeImported;
  const badgeColor =
    source === 'builtin'
      ? colors.sourceBuiltin
      : source === 'market'
        ? colors.primary
        : colors.sourceCustom;
  const badgeBackgroundColor =
    source === 'builtin'
      ? colors.sourceBuiltinMuted
      : source === 'market'
        ? colors.sourceMarketMuted
        : colors.sourceCustomMuted;

  return {
    avatar: getSkillAvatar(skill),
    badgeBackgroundColor,
    badgeColor,
    description: getSkillDescription(skill),
    id: skill.id,
    identifier: skill.identifier || skill.id,
    kind: 'skill',
    label,
    name: skill.name,
  };
};

const buildInstalledBuiltinItem = (
  identifier: string,
  t: I18nStore['t'],
  colors: Pick<
    ColorTokens,
    | 'primary'
    | 'fillTertiary'
    | 'secondaryText'
    | 'muted'
    | 'danger'
    | 'foreground'
    | 'sourceBuiltin'
    | 'sourceBuiltinMuted'
    | 'sourceCustom'
    | 'sourceCustomMuted'
    | 'sourceMarketMuted'
  >,
): StoreInstalledItem | null => {
  const builtin = MOBILE_RECOMMENDED_BUILTIN_SKILLS.find((item) => item.identifier === identifier);

  if (!builtin) return null;

  return {
    badgeBackgroundColor: colors.sourceBuiltinMuted,
    badgeColor: colors.sourceBuiltin,
    builtinIcon: builtin.icon,
    description: (t as any)[builtin.descriptionKey] ?? '',
    id: builtin.identifier,
    identifier: builtin.identifier,
    kind: 'builtin',
    label: t.storeBuiltIn,
    name: (t as any)[builtin.titleKey] ?? builtin.identifier,
  };
};

const filterMarketItemsByCategory = (
  items: MarketListItem[],
  categoryKey?: string,
  source?: ExploreSource,
) => {
  if (!categoryKey || categoryKey === ALL_CATEGORY_KEY) return items;

  const validKeys = source ? getValidCategoryKeys(source) : undefined;

  return items.filter((item) => {
    const rawCategory = item.category?.trim().toLowerCase();
    if (!rawCategory) return false;
    const normalizedCategory = validKeys
      ? normalizeCategoryKey(rawCategory, validKeys)
      : rawCategory;
    return rawCategory === categoryKey || normalizedCategory === categoryKey;
  });
};

const filterMarketItemsByQuery = (items: MarketListItem[], query?: string) => {
  const normalizedQuery = query?.trim().toLowerCase();
  if (!normalizedQuery) return items;

  return items.filter((item) =>
    [item.name, item.identifier, item.description, item.category]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => value.toLowerCase().includes(normalizedQuery)),
  );
};

const ItemCard = memo<{
  installed?: boolean;
  item: MarketListItem;
  onInstall: (item: MarketListItem) => void;
  onPress: (item: MarketListItem) => void;
}>(({ item, installed, onPress, onInstall }) => {
  const colors = useThemeColors();
  const { t } = useI18n();
  const typeLabel =
    item._source === 'mcp'
      ? t.storeMcp
      : item._source === 'builtin'
        ? t.storeBuiltIn
        : t.storeSkills;
  const isMcp = item._source === 'mcp';
  return (
    <PressableScale
      accessibilityLabel={item.name || item.identifier}
      accessibilityRole="button"
      className="bg-foreground/[0.02] rounded-xl p-3.5 mb-2.5 mx-5"
      onPress={() => onPress(item)}
    >
      <View className="flex-row items-start">
        <View
          className="w-10 h-10 rounded-xl items-center justify-center mr-3 overflow-hidden"
          style={{ backgroundColor: colors.fillTertiary }}
        >
          {item.avatar && !isEmojiAvatar(item.avatar) ? (
            <RNImage
              resizeMode="cover"
              source={{ uri: item.avatar }}
              style={{ borderRadius: 10, height: 40, width: 40 }}
            />
          ) : isEmojiAvatar(item.avatar) ? (
            <Text style={{ color: colors.foreground, fontSize: 20 }}>{item.avatar}</Text>
          ) : (
            <Box color={colors.secondaryText} size={18} strokeWidth={1.5} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View className="flex-row items-center">
            <Text className="text-foreground text-[14px] font-semibold flex-1" numberOfLines={1}>
              {item.name || item.identifier}
            </Text>
            <MetaTag
              backgroundColor={isMcp ? colors.sourceMarketMuted : colors.sourceBuiltinMuted}
              label={typeLabel}
              textColor={isMcp ? colors.sourceMarket : colors.sourceBuiltin}
            />
          </View>

          {item.description ? (
            <Text
              className="text-[12px] mt-0.5 leading-4"
              numberOfLines={2}
              style={{ color: colors.secondaryText }}
            >
              {item.description}
            </Text>
          ) : null}

          {item.author ? (
            <View className="flex-row items-center mt-1.5">
              <Text className="text-[11px]" style={{ color: colors.tertiaryText }}>
                {item.author}
              </Text>
            </View>
          ) : null}
        </View>

        {installed ? (
          <View
            accessibilityElementsHidden
            className="ml-2 mt-1 rounded-full w-7 h-7 items-center justify-center"
            importantForAccessibility="no-hide-descendants"
            style={{ backgroundColor: colors.primarySubtle }}
          >
            <Check color={colors.primary} size={14} strokeWidth={2.5} />
          </View>
        ) : (
          <TouchableOpacity
            accessibilityLabel={`${t.storeInstall}: ${item.name || item.identifier}`}
            accessibilityRole="button"
            activeOpacity={0.6}
            className="ml-2 mt-1 rounded-full w-7 h-7 items-center justify-center"
            hitSlop={{ bottom: 10, left: 10, right: 10, top: 10 }}
            style={{ backgroundColor: colors.primarySubtle }}
            onPress={(e) => {
              e.stopPropagation();
              onInstall(item);
            }}
          >
            <Download color={colors.primary} size={14} strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>
    </PressableScale>
  );
});
ItemCard.displayName = 'ItemCard';

const InstalledRow = memo<{
  item: StoreInstalledItem;
  onPress: () => void;
}>(({ item, onPress }) => {
  const colors = useThemeColors();
  return (
    <PressableScale
      accessibilityLabel={`${item.name}, ${item.label}`}
      accessibilityRole="button"
      className="flex-row items-center px-5 py-3 bg-background"
      onPress={onPress}
    >
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mr-3 overflow-hidden"
        style={{ backgroundColor: colors.fillTertiary }}
      >
        {item.builtinIcon ? (
          <BuiltinSkillIcon icon={item.builtinIcon} size={36} />
        ) : item.avatar && !isEmojiAvatar(item.avatar) ? (
          <RNImage
            resizeMode="cover"
            source={{ uri: item.avatar }}
            style={{ borderRadius: 8, height: 36, width: 36 }}
          />
        ) : isEmojiAvatar(item.avatar) ? (
          <Text style={{ color: colors.foreground, fontSize: 18 }}>{item.avatar}</Text>
        ) : (
          <Box color={colors.secondaryText} size={16} strokeWidth={1.5} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View className="flex-row items-center">
          <Text className="text-foreground text-[14px] font-semibold flex-1" numberOfLines={1}>
            {item.name}
          </Text>
          <MetaTag
            backgroundColor={item.badgeBackgroundColor}
            label={item.label}
            textColor={item.badgeColor}
          />
        </View>
        {item.description ? (
          <Text
            className="text-[11px] mt-0.5"
            numberOfLines={1}
            style={{ color: colors.secondaryText }}
          >
            {item.description}
          </Text>
        ) : (
          <Text
            className="text-[11px] mt-0.5"
            numberOfLines={1}
            style={{ color: colors.tertiaryText }}
          >
            {item.identifier}
          </Text>
        )}
      </View>

      <ChevronRight color={colors.secondaryText} size={16} strokeWidth={1.5} />
    </PressableScale>
  );
});
InstalledRow.displayName = 'InstalledRow';

const InstalledSeparator = () => <View className="mx-5 h-px bg-foreground/[0.04]" />;

function SimpleImportModal({
  buttonText,
  onClose,
  onImport,
  placeholder,
  title,
  visible,
}: {
  buttonText: string;
  onClose: () => void;
  onImport: (value: string) => Promise<void>;
  placeholder: string;
  title: string;
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [value, setValue] = useState('');
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!value.trim()) return;
    setImporting(true);
    try {
      await onImport(value.trim());
      setValue('');
      onClose();
    } catch {
      /* handled by caller */
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="bg-background rounded-t-2xl"
          style={{ paddingBottom: insets.bottom + 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center pt-3 pb-1">
            <View className="w-9 h-1 rounded-full bg-foreground/10" />
          </View>

          <View className="px-5 pb-4 pt-2">
            <Text className="text-foreground text-[18px] font-bold tracking-tight mb-4">
              {title}
            </Text>

            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-4"
              editable={!importing}
              placeholder={placeholder}
              placeholderTextColor={colors.muted}
              value={value}
              onChangeText={setValue}
            />

            <Pressable
              className="rounded-xl py-3.5 items-center"
              disabled={!value.trim() || importing}
              style={{ backgroundColor: value.trim() ? colors.primary : colors.fillTertiary }}
              onPress={handleImport}
            >
              {importing ? (
                <ActivityIndicator color={colors.iconOnPrimary} size="small" />
              ) : (
                <Text
                  className="font-semibold text-[15px]"
                  style={{
                    color: value.trim() ? colors.iconOnPrimary : colors.tertiaryText,
                  }}
                >
                  {buttonText}
                </Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function parseMcpJsonInput(value: string): {
  error?: string;
  identifier?: string;
  url?: string;
} {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { error: 'invalidJson' };
    }

    if ('mcpServers' in parsed && typeof parsed.mcpServers === 'object') {
      const keys = Object.keys(parsed.mcpServers);
      if (keys.length === 0) return { error: 'invalidStructure' };
      const identifier = keys[0];
      const config = parsed.mcpServers[identifier];
      if (config?.url) return { identifier, url: config.url };
      return { error: 'invalidStructure' };
    }

    const topLevelKeys = Object.keys(parsed);
    if (topLevelKeys.length === 1) {
      const identifier = topLevelKeys[0];
      const config = parsed[identifier];
      if (config?.url) return { identifier, url: config.url };
    }

    return { error: 'invalidStructure' };
  } catch {
    return { error: 'invalidJson' };
  }
}

function AddCustomMcpModal({
  onClose,
  onSave,
  t,
  visible,
}: {
  onClose: () => void;
  onSave: (params: {
    auth?: { token?: string; type: 'none' | 'bearer' };
    avatar?: string;
    description?: string;
    headers?: Record<string, string>;
    identifier: string;
    url: string;
  }) => Promise<void>;
  t: I18nStore['t'];
  visible: boolean;
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [identifier, setIdentifier] = useState('');
  const [url, setUrl] = useState('');
  const [authType, setAuthType] = useState<'none' | 'bearer'>('none');
  const [token, setToken] = useState('');
  const [description, setDescription] = useState('');
  const [avatar, setAvatar] = useState('');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [quickImportText, setQuickImportText] = useState('');
  const [quickImportError, setQuickImportError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'failed' | 'success' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isConnectionReady = Boolean(identifier.trim() && url.trim());
  const isQuickImportReady = Boolean(quickImportText.trim());

  const resetForm = () => {
    setIdentifier('');
    setUrl('');
    setAuthType('none');
    setToken('');
    setDescription('');
    setAvatar('');
    setHeaders([]);
    setShowAdvanced(false);
    setShowQuickImport(false);
    setQuickImportText('');
    setQuickImportError(null);
    setSaving(false);
    setTesting(false);
    setTestResult(null);
    setErrors({});
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};

    if (!identifier.trim()) {
      nextErrors.identifier = t.skillsCustomMcpIdentifierRequired;
    } else if (!/^[\w-]+$/.test(identifier.trim())) {
      nextErrors.identifier = t.skillsCustomMcpIdentifierInvalid;
    }

    if (!url.trim()) {
      nextErrors.url = t.skillsCustomMcpUrlRequired;
    } else {
      try {
        new URL(url.trim());
      } catch {
        nextErrors.url = t.skillsCustomMcpUrlInvalid;
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleQuickImport = () => {
    const text = quickImportText.trim();
    if (!text) {
      setQuickImportError(t.skillsCustomMcpQuickImportError);
      return;
    }

    const result = parseMcpJsonInput(text);
    if (result.error === 'invalidJson') {
      setQuickImportError(t.skillsCustomMcpQuickImportInvalidJson);
      return;
    }

    if (result.error === 'invalidStructure') {
      setQuickImportError(t.skillsCustomMcpQuickImportInvalidStructure);
      return;
    }

    if (result.identifier) setIdentifier(result.identifier);
    if (result.url) setUrl(result.url);
    setShowQuickImport(false);
    setQuickImportError(null);
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    if (!validate()) return;

    setTesting(true);
    setTestResult(null);

    try {
      const headerMap = headers.reduce<Record<string, string>>((acc, header) => {
        if (header.key.trim()) acc[header.key.trim()] = header.value;
        return acc;
      }, {});

      await mcpApi.getStreamableMcpServerManifest({
        auth: authType === 'bearer' ? { token, type: 'bearer' } : { type: 'none' },
        headers: Object.keys(headerMap).length > 0 ? headerMap : undefined,
        identifier: identifier.trim(),
        metadata: {
          avatar: avatar.trim() || undefined,
          description: description.trim() || undefined,
        },
        url: url.trim(),
      });
      setTestResult('success');
    } catch {
      setTestResult('failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const headerMap = headers.reduce<Record<string, string>>((acc, header) => {
        if (header.key.trim()) acc[header.key.trim()] = header.value;
        return acc;
      }, {});

      await onSave({
        auth: authType === 'bearer' ? { token, type: 'bearer' } : undefined,
        avatar: avatar.trim() || undefined,
        description: description.trim() || undefined,
        headers: Object.keys(headerMap).length > 0 ? headerMap : undefined,
        identifier: identifier.trim(),
        url: url.trim(),
      });
      resetForm();
      onClose();
    } catch {
      /* handled by caller */
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={handleClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={handleClose}>
        <Pressable
          className="bg-background rounded-t-2xl"
          style={{ maxHeight: '90%', paddingBottom: insets.bottom + 16 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center pt-3 pb-1">
            <View className="w-9 h-1 rounded-full bg-foreground/10" />
          </View>

          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View className="px-5 pb-4 pt-2">
              <Text className="text-foreground text-[18px] font-bold tracking-tight mb-4">
                {t.storeAddCustomMcp}
              </Text>

              {showQuickImport ? (
                <View className="mb-4">
                  {quickImportError ? (
                    <View
                      className="rounded-xl px-4 py-2.5 mb-2"
                      style={{ backgroundColor: 'rgba(255,59,48,0.12)' }}
                    >
                      <Text className="text-red-500 text-[13px]">{quickImportError}</Text>
                    </View>
                  ) : null}

                  <TextInput
                    multiline
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[13px] mb-2"
                    numberOfLines={8}
                    placeholder={t.skillsCustomMcpQuickImportPlaceholder}
                    placeholderTextColor={colors.muted}
                    style={{ minHeight: 160, textAlignVertical: 'top' }}
                    value={quickImportText}
                    onChangeText={(value) => {
                      setQuickImportText(value);
                      if (quickImportError) setQuickImportError(null);
                    }}
                  />

                  <View className="flex-row gap-2">
                    <Pressable
                      className="flex-1 py-2.5 px-4 rounded-lg items-center"
                      style={{ backgroundColor: colors.fillTertiary }}
                      onPress={() => setShowQuickImport(false)}
                    >
                      <Text
                        className="text-[13px] font-semibold"
                        style={{ color: colors.secondaryText }}
                      >
                        {t.cancel}
                      </Text>
                    </Pressable>

                    <Pressable
                      className="flex-1 rounded-lg py-2.5 px-4 items-center active:opacity-80"
                      disabled={!isQuickImportReady}
                      style={{
                        backgroundColor: isQuickImportReady ? colors.primary : colors.fillTertiary,
                      }}
                      onPress={handleQuickImport}
                    >
                      <Text
                        className="text-[13px] font-semibold"
                        style={{
                          color: isQuickImportReady ? colors.iconOnPrimary : colors.tertiaryText,
                        }}
                      >
                        {t.confirm}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  className="rounded-2xl py-3.5 items-center mb-4 active:opacity-80"
                  style={{
                    backgroundColor: colors.primarySubtle,
                    borderColor: colors.primaryBorder,
                    borderRadius: 16,
                    borderStyle: 'dashed',
                    borderWidth: 1.5,
                  }}
                  onPress={() => {
                    setQuickImportError(null);
                    setShowQuickImport(true);
                  }}
                >
                  <Text className="text-[14px] font-semibold" style={{ color: colors.primary }}>
                    {t.skillsCustomMcpQuickImport}
                  </Text>
                </Pressable>
              )}

              <Text className="text-[13px] font-medium mb-1.5" style={{ color: colors.foreground }}>
                {t.skillsCustomMcpIdentifier}
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                className={`bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-1 ${errors.identifier ? 'border border-red-500' : ''}`}
                editable={!saving}
                placeholder={t.skillsCustomMcpIdentifierPlaceholder}
                placeholderTextColor={colors.muted}
                value={identifier}
                onChangeText={(value) => {
                  setIdentifier(value);
                  if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: '' }));
                  setTestResult(null);
                }}
              />
              {errors.identifier ? (
                <Text className="text-red-500 text-[11px] mb-2">{errors.identifier}</Text>
              ) : (
                <View className="mb-2" />
              )}

              <Text className="text-[13px] font-medium mb-1.5" style={{ color: colors.foreground }}>
                {t.skillsCustomMcpUrl}
              </Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                className={`bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-1 ${errors.url ? 'border border-red-500' : ''}`}
                editable={!saving}
                keyboardType="url"
                placeholder={t.skillsCustomMcpUrlPlaceholder}
                placeholderTextColor={colors.muted}
                value={url}
                onChangeText={(value) => {
                  setUrl(value);
                  if (errors.url) setErrors((prev) => ({ ...prev, url: '' }));
                  setTestResult(null);
                }}
              />
              {errors.url ? (
                <Text className="text-red-500 text-[11px] mb-2">{errors.url}</Text>
              ) : (
                <View className="mb-2" />
              )}

              <Text className="text-[13px] font-medium mb-1.5" style={{ color: colors.foreground }}>
                {t.skillsCustomMcpAuth}
              </Text>
              <View className="flex-row mb-3 bg-foreground/5 rounded-xl p-1">
                <Pressable
                  className="flex-1 py-2.5 rounded-lg items-center"
                  style={
                    authType === 'none' ? { backgroundColor: colors.primarySubtle } : undefined
                  }
                  onPress={() => setAuthType('none')}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{
                      color: authType === 'none' ? colors.primary : colors.secondaryText,
                    }}
                  >
                    {t.skillsCustomMcpAuthNone}
                  </Text>
                </Pressable>
                <Pressable
                  className="flex-1 py-2.5 rounded-lg items-center"
                  style={
                    authType === 'bearer' ? { backgroundColor: colors.primarySubtle } : undefined
                  }
                  onPress={() => setAuthType('bearer')}
                >
                  <Text
                    className="text-[13px] font-semibold"
                    style={{
                      color: authType === 'bearer' ? colors.primary : colors.secondaryText,
                    }}
                  >
                    {t.skillsCustomMcpAuthBearer}
                  </Text>
                </Pressable>
              </View>

              {authType === 'bearer' ? (
                <>
                  <Text
                    className="text-[13px] font-medium mb-1.5"
                    style={{ color: colors.foreground }}
                  >
                    {t.skillsCustomMcpToken}
                  </Text>
                  <TextInput
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-3"
                    editable={!saving}
                    placeholder={t.skillsCustomMcpTokenPlaceholder}
                    placeholderTextColor={colors.muted}
                    value={token}
                    onChangeText={setToken}
                  />
                </>
              ) : null}

              <View className="mb-3">
                <Pressable
                  className="rounded-xl py-3 items-center active:opacity-80"
                  disabled={!isConnectionReady || testing}
                  style={{
                    backgroundColor: isConnectionReady ? colors.primary : colors.fillTertiary,
                  }}
                  onPress={handleTestConnection}
                >
                  {testing ? (
                    <ActivityIndicator color={colors.iconOnPrimary} size="small" />
                  ) : (
                    <Text
                      className="text-[13px] font-semibold"
                      style={{
                        color: isConnectionReady ? colors.iconOnPrimary : colors.tertiaryText,
                      }}
                    >
                      {t.skillsCustomMcpTestConnection}
                    </Text>
                  )}
                </Pressable>
              </View>

              {testResult ? (
                <View
                  className="rounded-xl px-4 py-2.5 mb-3"
                  style={{
                    backgroundColor:
                      testResult === 'success' ? colors.successSubtle : colors.dangerSubtle,
                  }}
                >
                  <Text
                    className="text-[13px]"
                    style={{ color: testResult === 'success' ? colors.success : colors.danger }}
                  >
                    {testResult === 'success'
                      ? t.skillsCustomMcpTestSuccess
                      : t.skillsCustomMcpTestFailed}
                  </Text>
                </View>
              ) : null}

              <Pressable
                className="flex-row items-center justify-between px-3 py-3 rounded-xl mb-2 active:opacity-80"
                style={{ backgroundColor: colors.fillQuaternary }}
                onPress={() => setShowAdvanced((value) => !value)}
              >
                <Text
                  className="text-[13px] font-semibold"
                  style={{
                    color: showAdvanced ? colors.primary : colors.foreground,
                  }}
                >
                  {t.skillsCustomMcpAdvanced}
                </Text>
                <ChevronRight
                  color={showAdvanced ? colors.primary : colors.muted}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ transform: [{ rotate: showAdvanced ? '90deg' : '0deg' }] }}
                />
              </Pressable>

              {showAdvanced ? (
                <>
                  <Text
                    className="text-[13px] font-medium mb-1.5"
                    style={{ color: colors.foreground }}
                  >
                    {t.skillsCustomMcpHeaders}
                  </Text>
                  {headers.map((header, index) => (
                    <View className="flex-row gap-2 mb-2" key={`${header.key}-${index}`}>
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="flex-1 bg-foreground/5 rounded-xl px-3 py-2.5 text-foreground text-[13px]"
                        placeholder={t.skillsCustomMcpHeaderKey}
                        placeholderTextColor={colors.muted}
                        value={header.key}
                        onChangeText={(value) => {
                          const nextHeaders = [...headers];
                          nextHeaders[index] = { ...nextHeaders[index], key: value };
                          setHeaders(nextHeaders);
                        }}
                      />
                      <TextInput
                        autoCapitalize="none"
                        autoCorrect={false}
                        className="flex-1 bg-foreground/5 rounded-xl px-3 py-2.5 text-foreground text-[13px]"
                        placeholder={t.skillsCustomMcpHeaderValue}
                        placeholderTextColor={colors.muted}
                        value={header.value}
                        onChangeText={(value) => {
                          const nextHeaders = [...headers];
                          nextHeaders[index] = { ...nextHeaders[index], value };
                          setHeaders(nextHeaders);
                        }}
                      />
                      <Pressable
                        className="justify-center px-1 active:opacity-60"
                        onPress={() =>
                          setHeaders(headers.filter((_, currentIndex) => currentIndex !== index))
                        }
                      >
                        <Trash2
                          color={colors.danger}
                          size={16}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable
                    className="mb-3 active:opacity-60"
                    onPress={() => setHeaders([...headers, { key: '', value: '' }])}
                  >
                    <Text className="text-[13px] font-medium" style={{ color: colors.primary }}>
                      + {t.skillsCustomMcpHeadersAdd}
                    </Text>
                  </Pressable>

                  <Text
                    className="text-[13px] font-medium mb-1.5"
                    style={{ color: colors.foreground }}
                  >
                    {t.skillsCustomMcpDesc}
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-3"
                    editable={!saving}
                    placeholder={t.skillsCustomMcpDescPlaceholder}
                    placeholderTextColor={colors.muted}
                    value={description}
                    onChangeText={setDescription}
                  />

                  <Text
                    className="text-[13px] font-medium mb-1.5"
                    style={{ color: colors.foreground }}
                  >
                    {t.skillsCustomMcpAvatar}
                  </Text>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="bg-foreground/5 rounded-xl px-4 py-3 text-foreground text-[14px] mb-3"
                    editable={!saving}
                    keyboardType="url"
                    placeholder={t.skillsCustomMcpAvatarPlaceholder}
                    placeholderTextColor={colors.muted}
                    value={avatar}
                    onChangeText={setAvatar}
                  />
                </>
              ) : null}

              <Pressable
                className="rounded-xl py-3.5 items-center mt-2 active:opacity-80"
                disabled={!isConnectionReady || saving}
                style={{
                  backgroundColor: isConnectionReady ? colors.primary : colors.fillTertiary,
                }}
                onPress={handleSave}
              >
                {saving ? (
                  <ActivityIndicator color={colors.iconOnPrimary} size="small" />
                ) : (
                  <Text
                    className="font-semibold text-[15px]"
                    style={{
                      color: isConnectionReady ? colors.iconOnPrimary : colors.tertiaryText,
                    }}
                  >
                    {t.save}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StoreItemModal({
  actionLoading,
  detail,
  onClose,
  onInstall,
  onUninstall,
  t,
}: {
  actionLoading: boolean;
  detail: StoreDetailItem | null;
  onClose: () => void;
  onInstall: () => void;
  onUninstall: () => void;
  t: I18nStore['t'];
}) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  if (!detail) return null;

  const isInstalled = Boolean(
    detail.installedPlugin || detail.installedSkill || detail.builtinItem,
  );
  const canInstall = Boolean(detail.marketItem) && !isInstalled;
  const canUninstall = Boolean(
    detail.installedPlugin || detail.installedSkill || detail.builtinItem,
  );

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={Boolean(detail)}
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="bg-background rounded-t-3xl px-5 pt-4"
          style={{ paddingBottom: insets.bottom + 20 }}
          onPress={(e) => e.stopPropagation()}
        >
          <View className="items-center pb-2">
            <View className="w-9 h-1 rounded-full bg-foreground/10" />
          </View>

          <View className="flex-row items-start">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center mr-3 overflow-hidden"
              style={{ backgroundColor: colors.fillTertiary }}
            >
              {detail.builtinItem?.builtinIcon ? (
                <BuiltinSkillIcon icon={detail.builtinItem.builtinIcon} size={48} />
              ) : detail.avatar && !isEmojiAvatar(detail.avatar) ? (
                <RNImage
                  resizeMode="cover"
                  source={{ uri: detail.avatar }}
                  style={{ borderRadius: 14, height: 48, width: 48 }}
                />
              ) : isEmojiAvatar(detail.avatar) ? (
                <Text style={{ color: colors.foreground, fontSize: 20 }}>{detail.avatar}</Text>
              ) : (
                <Package color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              )}
            </View>

            <View style={{ flex: 1 }}>
              <Text className="text-foreground text-[17px] font-semibold">{detail.name}</Text>
              {detail.description ? (
                <Text
                  className="text-[13px] leading-5 mt-1"
                  style={{ color: colors.secondaryText }}
                >
                  {detail.description}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="flex-row flex-wrap gap-2 mt-4">
            <View className="px-2 py-0.5 rounded-full bg-foreground/5">
              <Text className="text-[11px]" style={{ color: colors.secondaryText }}>
                {detail.identifier}
              </Text>
            </View>
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: colors.primarySubtle }}
            >
              <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>
                {detail.label}
              </Text>
            </View>
            {isInstalled ? (
              <View
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: colors.successSubtle }}
              >
                <Text className="text-[11px] font-medium" style={{ color: colors.success }}>
                  {t.storeInstalled}
                </Text>
              </View>
            ) : null}
          </View>

          {detail.author ? (
            <View className="mt-3">
              <Text className="text-[12px]" style={{ color: colors.secondaryText }}>
                {detail.author}
              </Text>
            </View>
          ) : null}

          {detail.installedSkill?.source === 'builtin' || detail.builtinItem ? (
            <Text className="text-[12px] leading-5 mt-4" style={{ color: colors.secondaryText }}>
              {t.storeBuiltIn}
            </Text>
          ) : null}

          <View className="mt-5 gap-2">
            {canInstall ? (
              <PressableScale
                className="rounded-xl py-3 items-center"
                disabled={actionLoading}
                style={{ backgroundColor: colors.primary }}
                onPress={onInstall}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.iconOnPrimary} size="small" />
                ) : (
                  <Text
                    className="text-[14px] font-semibold"
                    style={{ color: colors.iconOnPrimary }}
                  >
                    {t.storeInstall}
                  </Text>
                )}
              </PressableScale>
            ) : null}

            {canUninstall ? (
              <PressableScale
                className="rounded-xl py-3 items-center"
                disabled={actionLoading}
                style={{ backgroundColor: colors.dangerSubtle }}
                onPress={onUninstall}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.danger} size="small" />
                ) : (
                  <Text className="text-[14px] font-semibold" style={{ color: colors.danger }}>
                    {t.storeRemove}
                  </Text>
                )}
              </PressableScale>
            ) : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function StoreScreen() {
  const insets = useSafeAreaInsets();
  const scrollListPaddingBottom = useMainTabScrollableContentPaddingBottom();
  const colors = useThemeColors();
  const { t } = useI18n();
  const locale = useI18n((s) => s.locale);
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<StoreTab>('explore');
  const [installedKindFilter, setInstalledKindFilter] = useState<InstalledKindFilter>('all');
  const [activeExploreSource, setActiveExploreSource] = useState<ExploreSource>('mcp');
  const [activeExploreCategory, setActiveExploreCategory] = useState(ALL_CATEGORY_KEY);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [appliedSearchQuery, setAppliedSearchQuery] = useState('');
  const searchRef = useRef<TextInput>(null);

  const [marketItems, setMarketItems] = useState<MarketListItem[]>([]);
  const [marketCategoriesBySource, setMarketCategoriesBySource] = useState<
    Record<ExploreSource, MarketCategoryItem[]>
  >({
    mcp: [],
    skill: [],
  });
  const [marketMcpTotal, setMarketMcpTotal] = useState(0);
  const [marketSkillTotal, setMarketSkillTotal] = useState(0);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketPage, setMarketPage] = useState(1);
  const [marketHasMore, setMarketHasMore] = useState(true);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);
  const [marketSourceErrors, setMarketSourceErrors] = useState<Record<ExploreSource, boolean>>({
    mcp: false,
    skill: false,
  });
  const marketRequestIdRef = useRef(0);

  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [installedSkills, setInstalledSkills] = useState<AgentSkillItem[]>([]);
  const [uninstalledBuiltinTools, setUninstalledBuiltinTools] = useState<string[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);
  const [installedCatalogLoaded, setInstalledCatalogLoaded] = useState(false);
  const marketSnapshotRef = useRef<Record<ExploreSource, MarketListItem[]>>({
    mcp: [],
    skill: [],
  });
  const marketCategoryRequestIdRef = useRef<Record<ExploreSource, number>>({
    mcp: 0,
    skill: 0,
  });
  const installedRequestIdRef = useRef(0);
  const exploreSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryFetchHintShownRef = useRef<Set<ExploreSource>>(new Set());

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [importUrlVisible, setImportUrlVisible] = useState(false);
  const [importGithubVisible, setImportGithubVisible] = useState(false);
  const [addMcpVisible, setAddMcpVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SelectedStoreEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const installedIds = useMemo(
    () =>
      new Set([
        ...(installedCatalogLoaded
          ? MOBILE_RECOMMENDED_BUILTIN_SKILLS.filter(
              (item) => !uninstalledBuiltinTools.includes(item.identifier),
            ).map((item) => item.identifier)
          : []),
        ...installedPlugins.map((plugin) => plugin.identifier),
        ...installedSkills
          .map((skill) => skill.identifier)
          .filter((identifier): identifier is string => Boolean(identifier)),
      ]),
    [installedCatalogLoaded, installedPlugins, installedSkills, uninstalledBuiltinTools],
  );

  useEffect(() => {
    if (!searchVisible) return;
    const timer = setTimeout(() => searchRef.current?.focus(), 120);
    return () => clearTimeout(timer);
  }, [searchVisible]);

  useEffect(() => {
    if (searchQuery.trim().length === 0 && appliedSearchQuery.length > 0) {
      setAppliedSearchQuery('');
    }
  }, [appliedSearchQuery, searchQuery]);

  // Align server-side explore query when switching to Explore (same field filters Installed locally).
  useEffect(() => {
    if (activeTab !== 'explore') return;
    setAppliedSearchQuery(searchQuery.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on tab change; keystrokes use debounced effect
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'explore' || !searchVisible) {
      if (exploreSearchDebounceRef.current) {
        clearTimeout(exploreSearchDebounceRef.current);
        exploreSearchDebounceRef.current = null;
      }
      return;
    }

    const next = searchQuery.trim();
    if (exploreSearchDebounceRef.current) clearTimeout(exploreSearchDebounceRef.current);
    exploreSearchDebounceRef.current = setTimeout(() => {
      setAppliedSearchQuery(next);
      exploreSearchDebounceRef.current = null;
    }, 400);

    return () => {
      if (exploreSearchDebounceRef.current) {
        clearTimeout(exploreSearchDebounceRef.current);
        exploreSearchDebounceRef.current = null;
      }
    };
  }, [activeTab, searchQuery, searchVisible]);

  const fetchInstalledSummary = useCallback(
    async (options?: InstalledFetchOptions) => {
      const requestId = ++installedRequestIdRef.current;

      if (!options?.silent) {
        setInstalledLoading(true);
      }

      try {
        const [plugins, skills] = await Promise.all([
          pluginApi.list().catch(() => []),
          agentSkillApi.list().catch(() => []),
        ]);

        if (requestId !== installedRequestIdRef.current) return;

        setInstalledPlugins(Array.isArray(plugins) ? plugins : []);
        setInstalledSkills(Array.isArray(skills) ? skills : []);
      } catch {
        if (requestId !== installedRequestIdRef.current || options?.silent) return;
        toast.show('error', t.errorNetwork);
      } finally {
        if (requestId === installedRequestIdRef.current && !options?.silent) {
          setInstalledLoading(false);
        }
      }
    },
    [t.errorNetwork, toast],
  );

  const fetchInstalled = useCallback(
    async (options?: InstalledFetchOptions) => {
      const requestId = ++installedRequestIdRef.current;

      if (!options?.silent) {
        setInstalledLoading(true);
      }

      try {
        const [plugins, skills, builtinSkills, userState] = await Promise.all([
          pluginApi.list().catch(() => []),
          agentSkillApi.list().catch(() => []),
          agentSkillApi.list('builtin').catch(() => []),
          userApi.getState().catch(() => null),
        ]);
        const hiddenBuiltinIds = userState?.settings?.tool?.uninstalledBuiltinTools ?? [];
        const builtinSkillList = Array.isArray(builtinSkills) ? builtinSkills : [];
        const installedBuiltinSkills = builtinSkillList.filter((skill) => {
          const identifier = skill.identifier || skill.id;
          return Boolean(identifier) && !hiddenBuiltinIds.includes(identifier);
        });

        if (requestId !== installedRequestIdRef.current) return;

        setInstalledPlugins(Array.isArray(plugins) ? plugins : []);
        setInstalledSkills(
          mergeSkillLists(Array.isArray(skills) ? skills : [], installedBuiltinSkills),
        );
        setUninstalledBuiltinTools(hiddenBuiltinIds);
        setInstalledCatalogLoaded(true);
      } catch {
        if (requestId !== installedRequestIdRef.current || options?.silent) return;
        toast.show('error', t.errorNetwork);
      } finally {
        if (requestId === installedRequestIdRef.current && !options?.silent) {
          setInstalledLoading(false);
        }
      }
    },
    [t.errorNetwork, toast],
  );

  const marketFetchError = marketSourceErrors[activeExploreSource];
  const marketCategories = marketCategoriesBySource[activeExploreSource];

  const snapshotCategories = mergeCategoryBuckets(
    deriveCategoriesFromItems(marketSnapshotRef.current[activeExploreSource], activeExploreSource),
    activeExploreSource,
  );

  const categoryOptions = useMemo(
    () =>
      buildCategoryOptions(
        mergeCategoryBuckets([...marketCategories, ...snapshotCategories], activeExploreSource),
        activeExploreSource,
        locale,
      ),
    [activeExploreSource, locale, marketCategories, snapshotCategories],
  );

  const updateBuiltinSkillInstallation = useCallback(
    async (identifier: string, shouldInstall: boolean) => {
      const nextUninstalled = shouldInstall
        ? uninstalledBuiltinTools.filter((id) => id !== identifier)
        : Array.from(new Set([...uninstalledBuiltinTools, identifier]));

      await userApi.updateSettings({
        tool: {
          uninstalledBuiltinTools: nextUninstalled,
        },
      });

      setUninstalledBuiltinTools(nextUninstalled);
      await fetchInstalled();
    },
    [fetchInstalled, uninstalledBuiltinTools],
  );

  const fetchCategories = useCallback(
    async (source: ExploreSource, options?: { forceRefresh?: boolean }) => {
      const requestId = marketCategoryRequestIdRef.current[source] + 1;
      marketCategoryRequestIdRef.current[source] = requestId;

      setMarketCategoriesBySource((prev) => ({
        ...prev,
        [source]: mergeCategoryBuckets(
          [
            ...prev[source],
            ...deriveCategoriesFromItems(marketSnapshotRef.current[source], source),
          ],
          source,
        ),
      }));

      try {
        const list =
          source === 'mcp'
            ? await marketSkillApi.getMcpCategories({ q: appliedSearchQuery || undefined }, options)
            : await marketSkillApi.getCategories({ q: appliedSearchQuery || undefined }, options);

        if (requestId !== marketCategoryRequestIdRef.current[source]) return;

        const items = Array.isArray(list) ? list : [];
        categoryFetchHintShownRef.current.delete(source);
        setMarketCategoriesBySource((prev) => ({
          ...prev,
          [source]: mergeCategoryBuckets(
            [...items, ...deriveCategoriesFromItems(marketSnapshotRef.current[source], source)],
            source,
          ),
        }));
      } catch {
        if (requestId !== marketCategoryRequestIdRef.current[source]) return;
        if (!categoryFetchHintShownRef.current.has(source)) {
          categoryFetchHintShownRef.current.add(source);
          toast.show('info', t.storeCategoriesLoadHint);
        }
      }
    },
    [appliedSearchQuery, t.storeCategoriesLoadHint, toast],
  );

  const fetchMarket = useCallback(
    async (
      source: ExploreSource,
      page = 1,
      append = false,
      options?: { forceRefresh?: boolean },
    ) => {
      const requestId = ++marketRequestIdRef.current;

      if (append) {
        setMarketLoadingMore(true);
      } else {
        setMarketLoading(true);
        setMarketSourceErrors((prev) => ({ ...prev, [source]: false }));
      }

      const categoryParam =
        activeExploreCategory === ALL_CATEGORY_KEY ? undefined : activeExploreCategory;

      if (
        !append &&
        page === 1 &&
        !options?.forceRefresh &&
        !categoryParam &&
        !appliedSearchQuery
      ) {
        const snapshotItems = marketSnapshotRef.current[source];
        if (snapshotItems.length > 0) {
          setMarketItems(snapshotItems);
          setMarketPage(1);
          setMarketHasMore(true);
        }
      }

      try {
        const result =
          source === 'mcp'
            ? await marketSkillApi.getMcpList(
                {
                  category: categoryParam,
                  page,
                  pageSize: MARKET_PAGE_SIZE,
                  q: appliedSearchQuery || undefined,
                },
                options,
              )
            : await marketSkillApi.getSkillList(
                {
                  category: categoryParam,
                  page,
                  pageSize: MARKET_PAGE_SIZE,
                  q: appliedSearchQuery || undefined,
                },
                options,
              );

        if (requestId !== marketRequestIdRef.current) return;

        const remoteItems = result.items || [];
        const shouldRefreshSnapshot =
          !append && page === 1 && !categoryParam && !appliedSearchQuery;
        const resolvedTotalCount = Math.max(result.totalCount ?? 0, remoteItems.length);

        if (shouldRefreshSnapshot) {
          marketSnapshotRef.current[source] = remoteItems;
        }

        if (source === 'mcp') {
          setMarketMcpTotal((prev) =>
            page === 1 ? resolvedTotalCount : prev || resolvedTotalCount,
          );
        }
        if (source === 'skill') {
          setMarketSkillTotal((prev) =>
            page === 1 ? resolvedTotalCount : prev || resolvedTotalCount,
          );
        }

        if (!append && page === 1 && !categoryParam && remoteItems.length > 0) {
          setMarketCategoriesBySource((prev) => ({
            ...prev,
            [source]: mergeCategoryBuckets(
              [...prev[source], ...deriveCategoriesFromItems(remoteItems, source)],
              source,
            ),
          }));
        }

        setMarketItems((prev) =>
          append ? mergeMarketItems([...prev, ...remoteItems]) : remoteItems,
        );
        setMarketPage(page);
        setMarketHasMore(
          result.totalPages > 0
            ? result.currentPage < result.totalPages
            : remoteItems.length >= result.pageSize,
        );
      } catch {
        if (requestId !== marketRequestIdRef.current) return;
        if (append) return;

        setMarketSourceErrors((prev) => ({ ...prev, [source]: true }));

        const fallbackItems = filterMarketItemsByQuery(
          filterMarketItemsByCategory(
            marketSnapshotRef.current[source],
            activeExploreCategory,
            source,
          ),
          appliedSearchQuery,
        );
        setMarketItems(fallbackItems);
        setMarketCategoriesBySource((prev) => ({
          ...prev,
          [source]: mergeCategoryBuckets(
            [
              ...prev[source],
              ...deriveCategoriesFromItems(marketSnapshotRef.current[source], source),
            ],
            source,
          ),
        }));
        if (source === 'mcp') setMarketMcpTotal(fallbackItems.length);
        if (source === 'skill') setMarketSkillTotal(fallbackItems.length);
        setMarketHasMore(false);
        toast.show('error', t.storeLoadFailed || t.errorNetwork);
      } finally {
        if (requestId === marketRequestIdRef.current) {
          setMarketLoading(false);
          setMarketLoadingMore(false);
        }
      }
    },
    [activeExploreCategory, appliedSearchQuery, t.errorNetwork, t.storeLoadFailed, toast],
  );

  useEffect(() => {
    void fetchInstalledSummary({ silent: true });
  }, [fetchInstalledSummary]);

  // Fetch categories from API when switching explore source (MCP/Skills)
  useEffect(() => {
    if (activeTab !== 'explore') return;
    void fetchCategories(activeExploreSource);
  }, [activeTab, activeExploreSource, appliedSearchQuery, fetchCategories]);

  useEffect(() => {
    if (activeTab === 'installed' && !installedCatalogLoaded) void fetchInstalled();
  }, [activeTab, fetchInstalled, installedCatalogLoaded]);

  useEffect(() => {
    if (activeTab !== 'explore') return;
    void fetchMarket(activeExploreSource, 1, false);
  }, [activeExploreCategory, activeExploreSource, activeTab, appliedSearchQuery, fetchMarket]);

  useEffect(() => {
    if (!categoryOptions.some((item) => item.key === activeExploreCategory)) {
      setActiveExploreCategory(ALL_CATEGORY_KEY);
    }
  }, [activeExploreCategory, categoryOptions]);

  const refreshMarket = useCallback(async () => {
    if (activeTab !== 'explore') return;
    await Promise.all([
      fetchCategories(activeExploreSource, { forceRefresh: true }),
      fetchMarket(activeExploreSource, 1, false, { forceRefresh: true }),
    ]);
  }, [activeExploreSource, activeTab, fetchCategories, fetchMarket]);

  const loadMoreMarket = useCallback(async () => {
    if (activeTab !== 'explore' || marketLoading || marketLoadingMore || !marketHasMore) return;
    await fetchMarket(activeExploreSource, marketPage + 1, true);
  }, [
    activeExploreSource,
    activeTab,
    fetchMarket,
    marketHasMore,
    marketLoading,
    marketLoadingMore,
    marketPage,
  ]);

  const handleInstall = useCallback(
    async (item: MarketListItem) => {
      haptics.light();
      try {
        if (item._source === 'builtin') {
          await updateBuiltinSkillInstallation(item.identifier, true);
        } else {
          await marketSkillApi.install(item);
        }
        haptics.success();
        toast.show('success', t.storeInstallSuccess);
        await fetchInstalled();
        return true;
      } catch {
        toast.show('error', t.storeInstallFailed);
        return false;
      }
    },
    [
      fetchInstalled,
      t.storeInstallFailed,
      t.storeInstallSuccess,
      toast,
      updateBuiltinSkillInstallation,
    ],
  );

  const allInstalled = useMemo(() => {
    const builtinIdsAlreadyShown = new Set(
      installedSkills
        .map((skill) => skill.identifier || skill.id)
        .filter((identifier): identifier is string => Boolean(identifier)),
    );

    const builtinInstalledItems = installedCatalogLoaded
      ? MOBILE_RECOMMENDED_BUILTIN_SKILLS.filter(
          (item) =>
            !uninstalledBuiltinTools.includes(item.identifier) &&
            !builtinIdsAlreadyShown.has(item.identifier),
        )
          .map((item) => buildInstalledBuiltinItem(item.identifier, t, colors))
          .filter((item): item is StoreInstalledItem => Boolean(item))
      : [];

    return [
      ...builtinInstalledItems,
      ...installedPlugins.map((plugin) => buildInstalledPluginItem(plugin, t, colors)),
      ...installedSkills.map((skill) => buildInstalledSkillItem(skill, t, colors)),
    ];
  }, [
    colors,
    installedCatalogLoaded,
    installedPlugins,
    installedSkills,
    t,
    uninstalledBuiltinTools,
  ]);

  const installedKindCounts = useMemo(
    () => ({
      all: allInstalled.length,
      builtin: allInstalled.filter((item) => item.kind === 'builtin').length,
      plugin: allInstalled.filter((item) => item.kind === 'plugin').length,
      skill: allInstalled.filter((item) => item.kind === 'skill').length,
    }),
    [allInstalled],
  );

  const installedByKind = useMemo(() => {
    if (installedKindFilter === 'all') return allInstalled;
    return allInstalled.filter((item) => item.kind === installedKindFilter);
  }, [allInstalled, installedKindFilter]);

  const filteredInstalled = useMemo(() => {
    if (!searchQuery.trim()) return installedByKind;
    const query = searchQuery.trim().toLowerCase();

    return installedByKind.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.identifier.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    );
  }, [installedByKind, searchQuery]);

  const emptyStatePresentation = useMemo(() => {
    const onExplore = activeTab === 'explore';
    if (onExplore && marketFetchError) {
      return { iconVariant: 'warning' as const, title: t.storeLoadFailed };
    }
    if (onExplore && appliedSearchQuery.trim() && marketItems.length === 0) {
      return { iconVariant: 'store' as const, title: t.storeSearchNoResults };
    }
    if (
      !onExplore &&
      allInstalled.length > 0 &&
      searchQuery.trim() &&
      filteredInstalled.length === 0
    ) {
      return { iconVariant: 'store' as const, title: t.storeSearchNoResults };
    }
    if (
      !onExplore &&
      installedKindFilter !== 'all' &&
      allInstalled.length > 0 &&
      !searchQuery.trim() &&
      filteredInstalled.length === 0
    ) {
      return { iconVariant: 'store' as const, title: t.storeInstalledKindEmpty };
    }
    return { iconVariant: 'store' as const, title: t.storeEmpty };
  }, [
    activeTab,
    allInstalled.length,
    appliedSearchQuery,
    filteredInstalled.length,
    installedKindFilter,
    marketFetchError,
    marketItems.length,
    searchQuery,
    t.storeEmpty,
    t.storeInstalledKindEmpty,
    t.storeLoadFailed,
    t.storeSearchNoResults,
  ]);

  const selectedDetail = useMemo<StoreDetailItem | null>(() => {
    if (!selectedEntry) return null;

    if (selectedEntry.source === 'market') {
      const item = selectedEntry.item as MarketListItem;
      const installedPlugin =
        installedPlugins.find((plugin) => plugin.identifier === item.identifier) || null;
      const installedSkill =
        installedSkills.find((skill) => skill.identifier === item.identifier) || null;
      const builtinItem =
        item._source === 'builtin' && installedIds.has(item.identifier)
          ? buildInstalledBuiltinItem(item.identifier, t, colors)
          : null;

      return {
        avatar: item.avatar,
        author: item.author,
        builtinItem,
        description: item.description,
        identifier: item.identifier,
        installedPlugin,
        installedSkill,
        label:
          item._source === 'builtin'
            ? t.storeBuiltIn
            : item._source === 'mcp'
              ? t.storeMcp
              : t.storeSkills,
        marketItem: item,
        name: item.name || item.identifier,
      };
    }

    const item = selectedEntry.item as StoreInstalledItem;
    const installedPlugin =
      item.kind === 'plugin'
        ? installedPlugins.find((plugin) => plugin.identifier === item.identifier) || null
        : null;
    const installedSkill =
      item.kind === 'skill'
        ? installedSkills.find(
            (skill) => skill.id === item.id || skill.identifier === item.identifier,
          ) || null
        : null;
    const builtinItem = item.kind === 'builtin' ? item : null;

    return {
      avatar: item.avatar,
      author:
        installedPlugin?.manifest?.author ||
        ((installedSkill?.manifest as Record<string, any> | undefined)?.author as
          | string
          | undefined),
      description: item.description,
      identifier: item.identifier,
      builtinItem,
      installedPlugin,
      installedSkill,
      label: item.label,
      name: item.name,
    };
  }, [colors, installedIds, installedPlugins, installedSkills, selectedEntry, t]);

  const handleSelectedInstall = useCallback(async () => {
    if (!selectedDetail?.marketItem) return;

    setActionLoading(true);
    try {
      const installed = await handleInstall(selectedDetail.marketItem);
      if (installed) setSelectedEntry(null);
    } finally {
      setActionLoading(false);
    }
  }, [handleInstall, selectedDetail]);

  const handleSelectedUninstall = useCallback(() => {
    if (!selectedDetail?.installedPlugin && !selectedDetail?.installedSkill) return;

    Alert.alert(t.storeRemoveConfirm, t.storeRemoveDesc, [
      { style: 'cancel', text: t.cancel },
      {
        style: 'destructive',
        text: t.storeRemove,
        onPress: async () => {
          setActionLoading(true);
          haptics.light();
          try {
            if (selectedDetail.installedPlugin) {
              await pluginApi.remove(selectedDetail.installedPlugin.identifier);
            } else if (selectedDetail.builtinItem) {
              await updateBuiltinSkillInstallation(selectedDetail.builtinItem.identifier, false);
            } else if (selectedDetail.installedSkill?.source === 'builtin') {
              await updateBuiltinSkillInstallation(
                selectedDetail.installedSkill.identifier || selectedDetail.installedSkill.id,
                false,
              );
            } else if (selectedDetail.installedSkill) {
              await agentSkillApi.delete(selectedDetail.installedSkill.id);
            }
            toast.show('success', t.storeRemoved);
            setSelectedEntry(null);
            await fetchInstalled();
          } catch {
            toast.show('error', t.storeRemoveFailed);
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [
    fetchInstalled,
    selectedDetail,
    t.cancel,
    t.storeRemove,
    t.storeRemoveFailed,
    t.storeRemoved,
    t.storeRemoveConfirm,
    t.storeRemoveDesc,
    toast,
    updateBuiltinSkillInstallation,
  ]);

  const handleImportUrl = useCallback(
    async (url: string) => {
      try {
        await agentSkillApi.importFromUrl(url);
        toast.show('success', t.storeImportSuccess);
        setActiveTab('installed');
        await fetchInstalled();
      } catch {
        toast.show('error', t.storeImportFailed);
        throw new Error('import failed');
      }
    },
    [fetchInstalled, t.storeImportFailed, t.storeImportSuccess, toast],
  );

  const handleImportGitHub = useCallback(
    async (gitUrl: string) => {
      try {
        await agentSkillApi.importFromGitHub(gitUrl);
        toast.show('success', t.storeImportSuccess);
        setActiveTab('installed');
        await fetchInstalled();
      } catch {
        toast.show('error', t.storeImportFailed);
        throw new Error('import failed');
      }
    },
    [fetchInstalled, t.storeImportFailed, t.storeImportSuccess, toast],
  );

  const handleImportZip = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: [
          'application/zip',
          'application/x-zip-compressed',
          'application/octet-stream',
          'application/x-compressed',
        ],
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      if (!asset.name.toLowerCase().endsWith('.zip')) {
        toast.show('error', t.storeImportFailed);
        return;
      }

      haptics.light();
      const uploaded = await fileApi.upload(
        asset.uri,
        asset.name,
        asset.mimeType || 'application/zip',
        { skipCheckFileType: true },
      );
      await agentSkillApi.importFromZip(uploaded.id);
      toast.show('success', t.storeImportSuccess);
      setActiveTab('installed');
      await fetchInstalled();
    } catch {
      toast.show('error', t.storeImportFailed);
    }
  }, [fetchInstalled, t.storeImportFailed, t.storeImportSuccess, toast]);

  const handleAddCustomMcp = useCallback(
    async (params: {
      auth?: { token?: string; type: 'none' | 'bearer' };
      avatar?: string;
      description?: string;
      headers?: Record<string, string>;
      identifier: string;
      url: string;
    }) => {
      try {
        const mcpConfig: Record<string, any> = { type: 'http', url: params.url };
        if (params.auth && params.auth.type !== 'none') {
          mcpConfig.auth = params.auth;
        }
        if (params.headers) {
          mcpConfig.headers = params.headers;
        }

        let manifest: Record<string, any>;
        try {
          manifest = await mcpApi.getStreamableMcpServerManifest({
            auth: params.auth
              ? { token: params.auth.token, type: params.auth.type as 'none' | 'bearer' }
              : undefined,
            headers: params.headers,
            identifier: params.identifier.trim(),
            metadata: {
              avatar: params.avatar,
              description: params.description,
            },
            url: params.url.trim(),
          });
        } catch {
          manifest = {
            identifier: params.identifier,
            meta: {
              avatar: params.avatar,
              description: params.description || params.url,
              title: params.identifier,
            },
          };
        }

        await pluginApi.createOrInstall({
          customParams: {
            avatar: params.avatar,
            description: params.description,
            mcp: mcpConfig,
          },
          identifier: params.identifier,
          manifest,
          type: 'customPlugin',
        });

        toast.show('success', t.storeCustomMcpSaved);
        setActiveTab('installed');
        await fetchInstalled();
      } catch {
        toast.show('error', t.errorSaveFailed);
        throw new Error('save failed');
      }
    },
    [fetchInstalled, t.errorSaveFailed, t.storeCustomMcpSaved, toast],
  );

  const tabs = useMemo(
    () => [
      { label: t.storeExplore, value: 'explore' as const },
      {
        label:
          allInstalled.length > 0 ? `${t.storeInstalled} ${allInstalled.length}` : t.storeInstalled,
        value: 'installed' as const,
      },
    ],
    [allInstalled.length, t.storeExplore, t.storeInstalled],
  );
  const exploreSources = useMemo(
    () => [
      { key: 'mcp' as const, label: t.storeMcp },
      { key: 'skill' as const, label: t.storeSkills },
    ],
    [t.storeMcp, t.storeSkills],
  );
  const exploreSourceSwitchItems = useMemo(
    () => exploreSources.map((source) => ({ label: source.label, value: source.key })),
    [exploreSources],
  );

  const isExplore = activeTab === 'explore';
  const loading = isExplore ? marketLoading : installedLoading;
  const isEmpty = isExplore ? marketItems.length === 0 : filteredInstalled.length === 0;

  const renderMarketItem = useCallback(
    ({ item }: { item: MarketListItem }) => (
      <ItemCard
        installed={installedIds.has(item.identifier)}
        item={item}
        onInstall={(marketItem) => void handleInstall(marketItem)}
        onPress={(marketItem) => {
          haptics.light();
          setSelectedEntry({ item: marketItem, source: 'market' });
        }}
      />
    ),
    [handleInstall, installedIds],
  );

  const renderInstalledItem = useCallback(
    ({ item }: { item: StoreInstalledItem }) => (
      <InstalledRow
        item={item}
        onPress={() => {
          haptics.light();
          setSelectedEntry({ item, source: 'installed' });
        }}
      />
    ),
    [],
  );

  const currentExploreTotal = activeExploreSource === 'mcp' ? marketMcpTotal : marketSkillTotal;
  const activeExploreTotalCount =
    currentExploreTotal > 0
      ? Math.max(currentExploreTotal, marketItems.length)
      : marketItems.length;

  const toggleSearch = useCallback(() => {
    setSearchVisible((value) => {
      const next = !value;
      if (!next) {
        setSearchQuery('');
        setAppliedSearchQuery('');
      }
      return next;
    });
  }, []);

  const handleTabChange = useCallback((v: StoreTab) => {
    setInstalledKindFilter('all');
    setActiveTab(v);
  }, []);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        headerLevel="root"
        rightAccessibilityLabel={t.accessibilityAddStore}
        title={t.tabStore}
        rightActions={
          <View className="flex-row items-center" style={{ gap: 8 }}>
            <HeaderIconButton
              accessibilityLabel={t.storeSearch}
              active={searchVisible}
              onPress={toggleSearch}
            >
              {searchVisible ? (
                <X color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              ) : (
                <Search color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
              )}
            </HeaderIconButton>
            <HeaderIconButton
              accessibilityLabel={t.accessibilityAddStore}
              onPress={() => setShowCreateMenu(true)}
            >
              <Plus color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
            </HeaderIconButton>
          </View>
        }
      >
        {searchVisible ? (
          <SearchField
            accessibilityLabel={t.storeSearch}
            containerClassName="mx-6 mb-2"
            placeholder={t.storeSearch}
            ref={searchRef}
            returnKeyType="search"
            size="compact"
            value={searchQuery}
            rightElement={
              <TouchableOpacity
                accessibilityRole="button"
                hitSlop={8}
                accessibilityLabel={
                  searchQuery.length > 0
                    ? t.accessibilityStoreSearchClear
                    : t.accessibilityStoreSearchClose
                }
                onPress={() => {
                  if (exploreSearchDebounceRef.current) {
                    clearTimeout(exploreSearchDebounceRef.current);
                    exploreSearchDebounceRef.current = null;
                  }
                  if (searchQuery.length > 0) {
                    setSearchQuery('');
                    setAppliedSearchQuery('');
                    return;
                  }

                  setSearchVisible(false);
                  setSearchQuery('');
                  setAppliedSearchQuery('');
                }}
              >
                <X
                  color={colors.muted}
                  size={tokens.icon.size.sm}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
            }
            onChangeText={setSearchQuery}
            onSubmitEditing={() => {
              if (exploreSearchDebounceRef.current) {
                clearTimeout(exploreSearchDebounceRef.current);
                exploreSearchDebounceRef.current = null;
              }
              setAppliedSearchQuery(searchQuery.trim());
            }}
          />
        ) : null}

        <View className="px-6 pb-2">
          <SegmentedControl items={tabs} value={activeTab} onChange={handleTabChange} />
        </View>

        {isExplore ? (
          <>
            <ScrollView
              horizontal
              className="mb-1 px-6"
              contentContainerStyle={{ gap: 6, paddingRight: 12 }}
              showsHorizontalScrollIndicator={false}
            >
              <View style={{ flexShrink: 0, width: 156 }}>
                <SegmentedControl
                  items={exploreSourceSwitchItems}
                  value={activeExploreSource}
                  onChange={(value) => {
                    haptics.selection();
                    setActiveExploreCategory(ALL_CATEGORY_KEY);
                    setActiveExploreSource(value);
                  }}
                />
              </View>
              {categoryOptions.length > 0 ? <View style={{ width: 2 }} /> : null}
              {categoryOptions.map((category) => {
                const active = activeExploreCategory === category.key;
                return (
                  <FilterChip
                    active={active}
                    key={`${activeExploreSource}-${category.key}`}
                    label={category.label}
                    count={
                      category.count != null && category.count > 0
                        ? formatCount(category.count, locale)
                        : undefined
                    }
                    onPress={() => {
                      haptics.selection();
                      setActiveExploreCategory(category.key);
                    }}
                  />
                );
              })}
            </ScrollView>
          </>
        ) : (
          <ScrollView
            horizontal
            className="mb-1 px-6"
            contentContainerStyle={{ gap: 6, paddingRight: 12 }}
            showsHorizontalScrollIndicator={false}
          >
            <FilterChip
              active={installedKindFilter === 'all'}
              count={installedKindCounts.all > 0 ? installedKindCounts.all : undefined}
              label={t.storeInstalledFilterAll}
              onPress={() => {
                haptics.selection();
                setInstalledKindFilter('all');
              }}
            />
            <FilterChip
              active={installedKindFilter === 'builtin'}
              count={installedKindCounts.builtin > 0 ? installedKindCounts.builtin : undefined}
              label={t.storeBuiltIn}
              onPress={() => {
                haptics.selection();
                setInstalledKindFilter('builtin');
              }}
            />
            <FilterChip
              active={installedKindFilter === 'plugin'}
              count={installedKindCounts.plugin > 0 ? installedKindCounts.plugin : undefined}
              label={t.storeMcp}
              onPress={() => {
                haptics.selection();
                setInstalledKindFilter('plugin');
              }}
            />
            <FilterChip
              active={installedKindFilter === 'skill'}
              count={installedKindCounts.skill > 0 ? installedKindCounts.skill : undefined}
              label={t.storeSkills}
              onPress={() => {
                haptics.selection();
                setInstalledKindFilter('skill');
              }}
            />
          </ScrollView>
        )}
      </ScreenHeader>

      {loading && isEmpty ? (
        <CardSkeleton />
      ) : isEmpty && !loading ? (
        <View className="flex-1 items-center justify-center">
          <EmptyState
            iconVariant={emptyStatePresentation.iconVariant}
            title={emptyStatePresentation.title}
            action={
              isExplore && marketFetchError ? (
                <TouchableOpacity
                  accessibilityLabel={t.errorRetry}
                  accessibilityRole="button"
                  className="rounded-xl px-5 py-2.5"
                  style={{ backgroundColor: colors.primary }}
                  onPress={() => refreshMarket()}
                >
                  <Text className="font-semibold text-white text-[14px]">{t.errorRetry}</Text>
                </TouchableOpacity>
              ) : undefined
            }
          />
        </View>
      ) : isExplore ? (
        <FlatList
          data={marketItems}
          keyExtractor={(item) => `${item._source}-${item.identifier}`}
          renderItem={renderMarketItem}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            <View className="items-center pb-6 pt-3">
              {activeExploreTotalCount > 0 ? (
                <Text className="mb-2 text-[12px]" style={{ color: colors.secondaryText }}>
                  {marketItems.length} / {activeExploreTotalCount}
                </Text>
              ) : null}
              {marketLoadingMore ? (
                <ActivityIndicator color={colors.primary} size="small" />
              ) : marketHasMore ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  className="rounded-full px-4 py-2"
                  style={{ backgroundColor: colors.fillTertiary }}
                  onPress={() => void loadMoreMarket()}
                >
                  <Text className="text-[12px] font-semibold" style={{ color: colors.primary }}>
                    {t.storeLoadMore}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          contentContainerStyle={{
            paddingTop: 12,
            paddingBottom: scrollListPaddingBottom,
          }}
          refreshControl={
            <RefreshControl
              refreshing={marketLoading}
              tintColor={colors.primary}
              onRefresh={refreshMarket}
            />
          }
          onEndReached={loadMoreMarket}
          onEndReachedThreshold={0.3}
        />
      ) : (
        <FlatList
          ItemSeparatorComponent={InstalledSeparator}
          data={filteredInstalled}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          renderItem={renderInstalledItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: scrollListPaddingBottom,
          }}
          refreshControl={
            <RefreshControl
              refreshing={installedLoading}
              tintColor={colors.primary}
              onRefresh={fetchInstalled}
            />
          }
        />
      )}

      <Modal
        accessibilityViewIsModal
        transparent
        animationType="fade"
        visible={showCreateMenu}
        onRequestClose={() => setShowCreateMenu(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setShowCreateMenu(false)}
        >
          <Pressable
            className="bg-background rounded-t-3xl px-5 pt-4 pb-8"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-foreground text-[16px] font-semibold mb-3">
              {t.storeAddTitle}
            </Text>

            <TouchableOpacity
              activeOpacity={0.7}
              className="rounded-xl bg-foreground/[0.03] px-4 py-3.5 mb-2"
              onPress={() => {
                setShowCreateMenu(false);
                setImportUrlVisible(true);
              }}
            >
              <View className="flex-row items-center">
                <LinkIcon color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="text-foreground text-[14px] font-medium ml-3">
                  {t.storeImportUrl}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              className="rounded-xl bg-foreground/[0.03] px-4 py-3.5 mb-2"
              onPress={() => {
                setShowCreateMenu(false);
                setImportGithubVisible(true);
              }}
            >
              <View className="flex-row items-center">
                <Github color={colors.foreground} size={16} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="text-foreground text-[14px] font-medium ml-3">
                  {t.storeImportGithub}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              className="rounded-xl bg-foreground/[0.03] px-4 py-3.5 mb-2"
              onPress={() => {
                setShowCreateMenu(false);
                void handleImportZip();
              }}
            >
              <View className="flex-row items-center">
                <FileArchive
                  color={colors.fileArchive}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text className="text-foreground text-[14px] font-medium ml-3">
                  {t.storeUploadZip}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              className="rounded-xl bg-foreground/[0.03] px-4 py-3.5"
              onPress={() => {
                setShowCreateMenu(false);
                setAddMcpVisible(true);
              }}
            >
              <View className="flex-row items-center">
                <Plus color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="text-foreground text-[14px] font-medium ml-3">
                  {t.storeAddCustomMcp}
                </Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <SimpleImportModal
        buttonText={t.storeImportUrl}
        placeholder={t.storeImportUrlPlaceholder}
        title={t.storeImportUrl}
        visible={importUrlVisible}
        onClose={() => setImportUrlVisible(false)}
        onImport={handleImportUrl}
      />

      <SimpleImportModal
        buttonText={t.storeImportGithub}
        placeholder={t.storeImportGithubPlaceholder}
        title={t.storeImportGithub}
        visible={importGithubVisible}
        onClose={() => setImportGithubVisible(false)}
        onImport={handleImportGitHub}
      />

      <AddCustomMcpModal
        t={t}
        visible={addMcpVisible}
        onClose={() => setAddMcpVisible(false)}
        onSave={handleAddCustomMcp}
      />

      <StoreItemModal
        actionLoading={actionLoading}
        detail={selectedDetail}
        t={t}
        onClose={() => setSelectedEntry(null)}
        onInstall={() => void handleSelectedInstall()}
        onUninstall={handleSelectedUninstall}
      />
    </View>
  );
}
