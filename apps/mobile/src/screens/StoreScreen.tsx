/**
 * StoreScreen — single entry for browsing and managing extensions.
 *
 * Layout:
 * - Level 1: Explore | Installed
 * - Level 2 inside Explore: MCP | Skills
 * - Management actions stay inside Store via sheets/modals
 */
import { useFocusEffect } from '@react-navigation/native';
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

import CardSkeleton from '../components/ui/CardSkeleton';
import EmptyState from '../components/ui/EmptyState';
import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
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
import { haptics } from '../lib/haptics';
import { type I18nStore, type Locale, useI18n } from '../lib/i18n';
import { useSessionStore } from '../store/session';
import { type ColorTokens, useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { AgentSkillItem, InstalledPlugin } from '../types';

type ExploreSource = 'mcp' | 'skill';
type StoreTab = 'explore' | 'installed';

const MARKET_PAGE_SIZE = 21;

interface StoreInstalledItem {
  avatar?: string;
  badgeBackgroundColor: string;
  badgeColor: string;
  description?: string;
  id: string;
  identifier: string;
  kind: 'plugin' | 'skill';
  label: string;
  name: string;
}

interface SelectedStoreEntry {
  item: MarketListItem | StoreInstalledItem;
  source: 'installed' | 'market';
}

interface StoreDetailItem {
  author?: string;
  avatar?: string;
  description?: string;
  identifier: string;
  installedPlugin?: InstalledPlugin | null;
  installedSkill?: AgentSkillItem | null;
  label: string;
  marketItem?: MarketListItem;
  name: string;
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

const getSkillCategoryRaw = (skill: AgentSkillItem) => {
  const manifest = skill.manifest as Record<string, any> | undefined;
  return manifest?.meta?.category || manifest?.category;
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
  source: ExploreSource,
): MarketCategoryItem[] => {
  const validKeys =
    source === 'mcp' ? [...FALLBACK_MCP_CATEGORY_KEYS] : [...FALLBACK_SKILL_CATEGORY_KEYS];
  const countByCategory = new Map<string, number>();
  for (const item of items) {
    const raw = item.category?.trim();
    if (!raw) continue;
    const cat = normalizeCategoryKey(raw, validKeys) || raw;
    countByCategory.set(cat, (countByCategory.get(cat) ?? 0) + 1);
  }
  return Array.from(countByCategory.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0));
};

const buildCategoryOptions = (
  categories: MarketCategoryItem[],
  locale: Locale,
): Array<{ count?: number; key: string; label: string }> => {
  const normalized = categories
    .filter((item): item is MarketCategoryItem & { category: string } => Boolean(item?.category))
    .sort((left, right) => (right.count ?? 0) - (left.count ?? 0))
    .map((item) => ({
      count: item.count,
      key: item.category,
      label: getCategoryLabel(item.category, locale),
    }));

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

const matchesStoreQuery = (query: string, values: Array<string | undefined>) => {
  if (!query) return true;

  return values.some((value) => value?.toLowerCase().includes(query));
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

const ItemCard = memo<{
  installed?: boolean;
  item: MarketListItem;
  onInstall: (item: MarketListItem) => void;
  onPress: (item: MarketListItem) => void;
}>(({ item, installed, onPress, onInstall }) => {
  const colors = useThemeColors();
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
            <Text style={{ fontSize: 20 }}>{item.avatar}</Text>
          ) : (
            <Box color={colors.secondaryText} size={18} strokeWidth={1.5} />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <View className="flex-row items-center">
            <Text className="text-foreground text-[14px] font-semibold flex-1" numberOfLines={1}>
              {item.name || item.identifier}
            </Text>
            <View
              className="ml-2 rounded-md px-1.5 py-0.5"
              style={{
                backgroundColor:
                  item._source === 'mcp' || item._source === 'legacy'
                    ? colors.sourceMarketMuted
                    : colors.sourceBuiltinMuted,
              }}
            >
              <Text
                className="text-[9px] font-bold tracking-wide"
                style={{
                  color:
                    item._source === 'mcp' || item._source === 'legacy'
                      ? colors.sourceMarket
                      : colors.sourceBuiltin,
                }}
              >
                {item._source === 'mcp' || item._source === 'legacy' ? 'MCP' : 'SKILL'}
              </Text>
            </View>
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
            className="ml-2 mt-1 rounded-full w-7 h-7 items-center justify-center"
            style={{ backgroundColor: colors.primarySubtle }}
          >
            <Check color={colors.primary} size={14} strokeWidth={2.5} />
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.6}
            className="ml-2 mt-1 rounded-full w-7 h-7 items-center justify-center"
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
    <PressableScale className="flex-row items-center px-5 py-3 bg-background" onPress={onPress}>
      <View
        className="w-9 h-9 rounded-xl items-center justify-center mr-3 overflow-hidden"
        style={{ backgroundColor: colors.fillTertiary }}
      >
        {item.avatar && !isEmojiAvatar(item.avatar) ? (
          <RNImage
            resizeMode="cover"
            source={{ uri: item.avatar }}
            style={{ borderRadius: 8, height: 36, width: 36 }}
          />
        ) : isEmojiAvatar(item.avatar) ? (
          <Text style={{ fontSize: 18 }}>{item.avatar}</Text>
        ) : (
          <Box color={colors.secondaryText} size={16} strokeWidth={1.5} />
        )}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <View className="flex-row items-center">
          <Text className="text-foreground text-[14px] font-semibold flex-1" numberOfLines={1}>
            {item.name}
          </Text>
          <View
            className="ml-2 rounded-md px-1.5 py-0.5"
            style={{ backgroundColor: item.badgeBackgroundColor }}
          >
            <Text className="text-[9px] font-bold tracking-wide" style={{ color: item.badgeColor }}>
              {item.label}
            </Text>
          </View>
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
          <Text className="text-[11px] mt-0.5" numberOfLines={1} style={{ color: colors.tertiaryText }}>
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
              style={{ backgroundColor: value.trim() ? colors.primary : colors.fillTertiary }}
              disabled={!value.trim() || importing}
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
                      <Text className="text-[13px] font-semibold" style={{ color: colors.secondaryText }}>
                        {t.cancel}
                      </Text>
                    </Pressable>

                    <Pressable
                      className="flex-1 rounded-lg py-2.5 px-4 items-center active:opacity-80"
                      style={{ backgroundColor: isQuickImportReady ? colors.primary : colors.fillTertiary }}
                      disabled={!isQuickImportReady}
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
                  style={authType === 'none' ? { backgroundColor: colors.primarySubtle } : undefined}
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
                  style={authType === 'bearer' ? { backgroundColor: colors.primarySubtle } : undefined}
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
                  <Text className="text-[13px] font-medium mb-1.5" style={{ color: colors.foreground }}>
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
                  style={{ backgroundColor: isConnectionReady ? colors.primary : colors.fillTertiary }}
                  disabled={!isConnectionReady || testing}
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
                  style={{ backgroundColor: testResult === 'success' ? colors.successSubtle : colors.dangerSubtle }}
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
                  <Text className="text-[13px] font-medium mb-1.5" style={{ color: colors.foreground }}>
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

                  <Text className="text-[13px] font-medium mb-1.5" style={{ color: colors.foreground }}>
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

                  <Text className="text-[13px] font-medium mb-1.5" style={{ color: colors.foreground }}>
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
                style={{ backgroundColor: isConnectionReady ? colors.primary : colors.fillTertiary }}
                disabled={!isConnectionReady || saving}
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

  const isInstalled = Boolean(detail.installedPlugin || detail.installedSkill);
  const canInstall = Boolean(detail.marketItem) && !isInstalled;
  const canUninstall = Boolean(detail.installedPlugin || detail.installedSkill);

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
              {detail.avatar && !isEmojiAvatar(detail.avatar) ? (
                <RNImage
                  resizeMode="cover"
                  source={{ uri: detail.avatar }}
                  style={{ borderRadius: 14, height: 48, width: 48 }}
                />
              ) : isEmojiAvatar(detail.avatar) ? (
                <Text style={{ fontSize: 20 }}>{detail.avatar}</Text>
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
            <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primarySubtle }}>
              <Text className="text-[11px] font-medium" style={{ color: colors.primary }}>{detail.label}</Text>
            </View>
            {isInstalled ? (
              <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.successSubtle }}>
                <Text className="text-[11px] font-medium" style={{ color: colors.success }}>{t.storeInstalled}</Text>
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

          {detail.installedSkill?.source === 'builtin' ? (
            <Text
              className="text-[12px] leading-5 mt-4"
              style={{ color: colors.secondaryText }}
            >
              {t.storeBuiltIn}
            </Text>
          ) : null}

          <View className="mt-5 gap-2">
            {canInstall ? (
              <PressableScale
                className="rounded-xl py-3 items-center"
                style={{ backgroundColor: colors.primary }}
                disabled={actionLoading}
                onPress={onInstall}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.iconOnPrimary} size="small" />
                ) : (
                  <Text className="text-[14px] font-semibold" style={{ color: colors.iconOnPrimary }}>{t.storeInstall}</Text>
                )}
              </PressableScale>
            ) : null}

            {canUninstall ? (
              <PressableScale
                className="rounded-xl py-3 items-center bg-red-500/10"
                disabled={actionLoading}
                onPress={onUninstall}
              >
                {actionLoading ? (
                  <ActivityIndicator color={colors.danger} size="small" />
                ) : (
                  <Text className="text-red-500 text-[14px] font-semibold">{t.storeRemove}</Text>
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
  const colors = useThemeColors();
  const { t } = useI18n();
  const locale = useI18n((s) => s.locale);
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<StoreTab>('explore');
  const [activeExploreSource, setActiveExploreSource] = useState<ExploreSource>('mcp');
  const [activeExploreCategory, setActiveExploreCategory] = useState(ALL_CATEGORY_KEY);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [marketItems, setMarketItems] = useState<MarketListItem[]>([]);
  const [marketCategories, setMarketCategories] = useState<MarketCategoryItem[]>([]);
  const [marketMcpTotal, setMarketMcpTotal] = useState(0);
  const [marketSkillTotal, setMarketSkillTotal] = useState(0);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketPage, setMarketPage] = useState(1);
  const [marketHasMore, setMarketHasMore] = useState(true);
  const [marketLoadingMore, setMarketLoadingMore] = useState(false);
  const [marketFetchError, setMarketFetchError] = useState(false);
  const marketRequestIdRef = useRef(0);

  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [installedSkills, setInstalledSkills] = useState<AgentSkillItem[]>([]);
  const [uninstalledBuiltinTools, setUninstalledBuiltinTools] = useState<string[]>([]);
  const [installedLoading, setInstalledLoading] = useState(false);

  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [importUrlVisible, setImportUrlVisible] = useState(false);
  const [importGithubVisible, setImportGithubVisible] = useState(false);
  const [addMcpVisible, setAddMcpVisible] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<SelectedStoreEntry | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const installedIds = useMemo(
    () =>
      new Set([
        ...installedPlugins.map((plugin) => plugin.identifier),
        ...installedSkills
          .map((skill) => skill.identifier)
          .filter((identifier): identifier is string => Boolean(identifier)),
      ]),
    [installedPlugins, installedSkills],
  );

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchQuery]);

  const fetchInstalled = useCallback(async () => {
    setInstalledLoading(true);
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

      setInstalledPlugins(Array.isArray(plugins) ? plugins : []);
      setInstalledSkills(
        mergeSkillLists(Array.isArray(skills) ? skills : [], installedBuiltinSkills),
      );
      setUninstalledBuiltinTools(hiddenBuiltinIds);
    } catch {
      toast.show('error', t.errorNetwork);
    } finally {
      setInstalledLoading(false);
    }
  }, [t.errorNetwork, toast]);

  useFocusEffect(
    useCallback(() => {
      void useSessionStore.getState().fetchSessions();
    }, []),
  );

  const categoryOptions = useMemo(
    () => buildCategoryOptions(marketCategories, locale),
    [locale, marketCategories],
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

  const fetchCategories = useCallback(async (source: ExploreSource) => {
    // Set fallback immediately so user never sees empty or wrong categories
    const fallbackKeys =
      source === 'mcp' ? FALLBACK_MCP_CATEGORY_KEYS : FALLBACK_SKILL_CATEGORY_KEYS;
    const fallback = fallbackKeys
      .filter((k) => k !== ALL_CATEGORY_KEY)
      .map((category) => ({ category, count: undefined }));
    setMarketCategories(fallback);

    try {
      const list =
        source === 'mcp'
          ? await marketSkillApi.getMcpCategories()
          : await marketSkillApi.getCategories();
      const items = Array.isArray(list) ? list : [];
      if (items.length > 0) {
        setMarketCategories(items);
      }
      // else keep fallback
    } catch {
      // keep fallback
    }
  }, []);

  const fetchExploreTotals = useCallback(async () => {
    try {
      const [mcpResult, skillResult] = await Promise.all([
        marketSkillApi.getMcpList({ page: 1, pageSize: 1 }),
        marketSkillApi.getSkillList({ page: 1, pageSize: 1 }),
      ]);

      setMarketMcpTotal(mcpResult.totalCount ?? 0);
      setMarketSkillTotal(skillResult.totalCount ?? 0);
    } catch {
      // Keep existing counts if totals cannot be refreshed.
    }
  }, []);

  const fetchMarket = useCallback(
    async (source: ExploreSource, page = 1, append = false) => {
      const requestId = ++marketRequestIdRef.current;

      if (append) {
        setMarketLoadingMore(true);
      } else {
        setMarketLoading(true);
        setMarketFetchError(false);
      }

      const categoryParam =
        activeExploreCategory === ALL_CATEGORY_KEY ? undefined : activeExploreCategory;

      try {
        const result =
          source === 'mcp'
            ? await marketSkillApi.getMcpList({
                category: categoryParam,
                page,
                pageSize: MARKET_PAGE_SIZE,
                q: debouncedQuery || undefined,
              })
            : await marketSkillApi.getSkillList({
                category: categoryParam,
                page,
                pageSize: MARKET_PAGE_SIZE,
                q: debouncedQuery || undefined,
              });

        if (requestId !== marketRequestIdRef.current) return;

        const remoteItems = result.items || [];
        if (source === 'mcp') setMarketMcpTotal(result.totalCount ?? 0);
        if (source === 'skill') setMarketSkillTotal(result.totalCount ?? 0);

        // Fallback: when categories API failed, derive from "all" items
        if (!append && page === 1 && !categoryParam && remoteItems.length > 0) {
          setMarketCategories((prev) =>
            prev.length === 0 ? deriveCategoriesFromItems(remoteItems, source) : prev,
          );
        }

        // Explore lists community data only; builtin skills stay in Installed tab (align with Web)
        const nextItems = remoteItems;

        setMarketItems((prev) =>
          append ? mergeMarketItems([...prev, ...remoteItems]) : nextItems,
        );
        setMarketPage(page);
        setMarketHasMore(remoteItems.length >= MARKET_PAGE_SIZE);
      } catch {
        if (requestId !== marketRequestIdRef.current) return;
        setMarketFetchError(true);
        if (!append) setMarketItems([]);
        toast.show('error', t.errorNetwork);
      } finally {
        if (requestId === marketRequestIdRef.current) {
          setMarketLoading(false);
          setMarketLoadingMore(false);
        }
      }
    },
    [activeExploreCategory, debouncedQuery, t.errorNetwork, toast],
  );

  useEffect(() => {
    void fetchInstalled();
  }, [fetchInstalled]);

  // Fetch categories from API when switching explore source (MCP/Skills)
  useEffect(() => {
    if (activeTab !== 'explore') return;
    void fetchCategories(activeExploreSource);
  }, [activeTab, activeExploreSource, fetchCategories]);

  useEffect(() => {
    if (activeTab !== 'explore') return;
    void fetchExploreTotals();
  }, [activeTab, fetchExploreTotals]);

  useEffect(() => {
    if (activeTab === 'installed') void fetchInstalled();
  }, [activeTab, fetchInstalled]);

  useEffect(() => {
    if (activeTab !== 'explore') return;
    void fetchMarket(activeExploreSource, 1, false);
  }, [activeExploreCategory, activeExploreSource, activeTab, debouncedQuery, fetchMarket]);

  useEffect(() => {
    if (!categoryOptions.some((item) => item.key === activeExploreCategory)) {
      setActiveExploreCategory(ALL_CATEGORY_KEY);
    }
  }, [activeExploreCategory, categoryOptions]);

  const refreshMarket = useCallback(async () => {
    if (activeTab !== 'explore') return;
    await fetchMarket(activeExploreSource, 1, false);
  }, [activeExploreSource, activeTab, fetchMarket]);

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

  const allInstalled = useMemo(
    () => [
      ...installedPlugins.map((plugin) => buildInstalledPluginItem(plugin, t, colors)),
      ...installedSkills.map((skill) => buildInstalledSkillItem(skill, t, colors)),
    ],
    [colors, installedPlugins, installedSkills, t],
  );

  const filteredInstalled = useMemo(() => {
    if (!debouncedQuery) return allInstalled;
    const query = debouncedQuery.toLowerCase();

    return allInstalled.filter(
      (item) =>
        item.name.toLowerCase().includes(query) ||
        item.identifier.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query),
    );
  }, [allInstalled, debouncedQuery]);

  const selectedDetail = useMemo<StoreDetailItem | null>(() => {
    if (!selectedEntry) return null;

    if (selectedEntry.source === 'market') {
      const item = selectedEntry.item as MarketListItem;
      const installedPlugin =
        installedPlugins.find((plugin) => plugin.identifier === item.identifier) || null;
      const installedSkill =
        installedSkills.find((skill) => skill.identifier === item.identifier) || null;

      return {
        avatar: item.avatar,
        author: item.author,
        description: item.description,
        identifier: item.identifier,
        installedPlugin,
        installedSkill,
        label:
          item._source === 'builtin'
            ? t.storeBuiltIn
            : item._source === 'mcp' || item._source === 'legacy'
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

    return {
      avatar: item.avatar,
      author:
        installedPlugin?.manifest?.author ||
        ((installedSkill?.manifest as Record<string, any> | undefined)?.author as
          | string
          | undefined),
      description: item.description,
      identifier: item.identifier,
      installedPlugin,
      installedSkill,
      label: item.label,
      name: item.name,
    };
  }, [installedPlugins, installedSkills, selectedEntry, t.storeBuiltIn, t.storeMcp, t.storeSkills]);

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

  const tabs: { key: StoreTab; label: string }[] = [
    { key: 'explore', label: t.storeExplore },
    { key: 'installed', label: t.storeInstalled },
  ];
  const exploreSources: { key: ExploreSource; label: string }[] = [
    { key: 'mcp', label: t.storeMcp },
    { key: 'skill', label: t.storeSkills },
  ];

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

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        rightAccessibilityLabel={t.accessibilityAddStore}
        title={t.tabStore}
        rightElement={
          <Plus color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        }
        titleIcon={
          <Package color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressRight={() => setShowCreateMenu(true)}
      >
        <View className="mx-5 mb-2 flex-row items-center rounded-xl bg-foreground/[0.04] px-3.5 py-2.5">
          <Search color={colors.muted} size={16} strokeWidth={2} />
          <TextInput
            className="flex-1 text-foreground text-[14px] ml-2.5"
            placeholder={t.storeSearch}
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity hitSlop={8} onPress={() => setSearchQuery('')}>
              <X color={colors.muted} size={16} strokeWidth={2} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          className="mx-4 mb-2"
          contentContainerStyle={{ gap: 4 }}
          showsHorizontalScrollIndicator={false}
        >
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity
                activeOpacity={0.7}
                className="rounded-full px-4 py-1.5"
                key={tab.key}
                style={{
                  backgroundColor: active ? colors.primary : colors.fillTertiary,
                }}
                onPress={() => {
                  haptics.selection();
                  setActiveTab(tab.key);
                }}
              >
                <Text
                  className="text-[13px] font-semibold"
                  style={{ color: active ? colors.iconOnPrimary : colors.muted }}
                >
                  {tab.label}
                  {tab.key === 'installed' && allInstalled.length > 0
                    ? ` ${allInstalled.length}`
                    : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isExplore ? (
          <>
            <ScrollView
              horizontal
              className="mx-4 mb-1"
              contentContainerStyle={{ gap: 6 }}
              showsHorizontalScrollIndicator={false}
            >
              {exploreSources.map((source) => {
                const active = activeExploreSource === source.key;
                const total = source.key === 'mcp' ? marketMcpTotal : marketSkillTotal;
                const countStr = total > 0 ? ` ${formatCount(total, locale)}` : '';
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="rounded-full px-4 py-1.5"
                    key={source.key}
                    style={{
                      backgroundColor: active ? colors.primaryMuted : colors.fillTertiary,
                      minWidth: 72,
                    }}
                    onPress={() => {
                      haptics.selection();
                      setActiveExploreCategory(ALL_CATEGORY_KEY);
                      setActiveExploreSource(source.key);
                    }}
                  >
                    <Text
                      className="text-[12px] font-semibold"
                      style={{
                        color: active ? colors.primary : colors.muted,
                        flexShrink: 0,
                      }}
                    >
                      {source.label}
                      {countStr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ScrollView
              horizontal
              className="mx-4 mb-1"
              contentContainerStyle={{ gap: 6, paddingRight: 12 }}
              showsHorizontalScrollIndicator={false}
            >
              {categoryOptions.map((category) => {
                const active = activeExploreCategory === category.key;
                const countStr =
                  category.count != null && category.count > 0
                    ? ` ${formatCount(category.count, locale)}`
                    : '';
                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="rounded-full px-4 py-1.5"
                    key={`${activeExploreSource}-${category.key}`}
                    style={{
                      backgroundColor: active ? colors.primaryMuted : colors.fillTertiary,
                      minWidth: 72,
                    }}
                    onPress={() => {
                      haptics.selection();
                      setActiveExploreCategory(category.key);
                    }}
                  >
                    <Text
                      className="text-[12px] font-semibold"
                      style={{
                        color: active ? colors.primary : colors.muted,
                        flexShrink: 0,
                      }}
                    >
                      {category.label}
                      {countStr}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </>
        ) : null}
      </ScreenHeader>

      {loading && isEmpty ? (
        <CardSkeleton />
      ) : isEmpty && !loading ? (
        <View className="flex-1 items-center justify-center">
          <EmptyState
            iconVariant={marketFetchError ? 'warning' : 'store'}
            title={marketFetchError ? t.storeLoadFailed : t.storeEmpty}
            action={
              marketFetchError ? (
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
          contentContainerStyle={{ paddingTop: 12, paddingBottom: insets.bottom + 80 }}
          data={marketItems}
          keyExtractor={(item) => `${item._source}-${item.identifier}`}
          renderItem={renderMarketItem}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            marketLoadingMore ? (
              <View className="py-4 items-center">
                <ActivityIndicator color={colors.primary} size="small" />
              </View>
            ) : null
          }
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
          contentContainerStyle={{ paddingTop: 8, paddingBottom: insets.bottom + 80 }}
          data={filteredInstalled}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          renderItem={renderInstalledItem}
          showsVerticalScrollIndicator={false}
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
          className="flex-1 justify-end bg-black/30"
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
                <FileArchive color={colors.fileArchive} size={16} strokeWidth={tokens.icon.strokeWidth} />
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
