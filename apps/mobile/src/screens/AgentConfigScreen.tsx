import {
  ArrowLeft,
  Bot,
  ChevronDown,
  ChevronRight,
  Cpu,
  MessageSquare,
  Puzzle,
  Save,
  Settings2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image as RNImage,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { BuiltinSkillIcon } from '../components/ui/BuiltinSkillIcon';
import ContentSkeleton from '../components/ui/ContentSkeleton';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import type { MobileRecommendedBuiltinIcon } from '../constants/recommendedBuiltins';
import { MOBILE_RECOMMENDED_BUILTIN_SKILLS } from '../constants/recommendedBuiltins';
import { useAgentConfig, useAgentConfigByAgentId } from '../hooks/useAgentConfig';
import { agentApi, agentSkillApi, pluginApi, userApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useModelStore } from '../store/model';
import { useSessionStore } from '../store/session';
import { useThemeStore } from '../store/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { AgentSkillItem, InstalledPlugin, MobileMemoryEffort } from '../types';

interface AgentDraft {
  agentId: string;
  autoCreateTopicThreshold: string;
  avatar: string;
  description: string;
  enableAutoCreateTopic: boolean;
  enableCompressHistory: boolean;
  enableHistoryCount: boolean;
  enableStreaming: boolean;
  frequencyPenalty: string;
  historyCount: string;
  maxTokens: string;
  memoryEffort: MobileMemoryEffort;
  memoryEnabled: boolean;
  model: string;
  openingMessage: string;
  openingQuestions: string;
  presencePenalty: string;
  provider: string;
  searchMode: 'auto' | 'off';
  systemRole: string;
  temperature: string;
  title: string;
  topP: string;
}

interface BuiltinSkillEntry {
  description: string;
  icon: MobileRecommendedBuiltinIcon;
  identifier: string;
  title: string;
}

const stringifyNumber = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : '';

const normalizeText = (value: string) => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const splitLineList = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

const buildDraft = (config: any): AgentDraft => ({
  agentId: config?.id || '',
  autoCreateTopicThreshold: stringifyNumber(config?.chatConfig?.autoCreateTopicThreshold),
  avatar: config?.avatar || '',
  description: config?.description || '',
  enableAutoCreateTopic: !!config?.chatConfig?.enableAutoCreateTopic,
  enableCompressHistory: !!config?.chatConfig?.enableCompressHistory,
  enableHistoryCount: !!config?.chatConfig?.enableHistoryCount,
  enableStreaming: config?.chatConfig?.enableStreaming !== false,
  frequencyPenalty: stringifyNumber(config?.params?.frequency_penalty),
  historyCount: stringifyNumber(config?.chatConfig?.historyCount),
  maxTokens: stringifyNumber(config?.params?.max_tokens),
  memoryEffort: config?.chatConfig?.memory?.effort || 'medium',
  memoryEnabled: config?.chatConfig?.memory?.enabled !== false,
  model: config?.model || '',
  openingMessage: config?.openingMessage || '',
  openingQuestions: Array.isArray(config?.openingQuestions)
    ? config.openingQuestions.join('\n')
    : '',
  presencePenalty: stringifyNumber(config?.params?.presence_penalty),
  provider: config?.provider || '',
  searchMode: config?.chatConfig?.searchMode === 'off' ? 'off' : 'auto',
  systemRole: config?.systemRole || '',
  temperature: stringifyNumber(config?.params?.temperature),
  title: config?.title || '',
  topP: stringifyNumber(config?.params?.top_p),
});

function SectionCard({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <View className="mb-5 px-5">
      <Text className="mb-2 px-2 text-[12px] font-medium uppercase tracking-wider text-secondary/60">
        {title}
      </Text>
      <View className="rounded-2xl bg-foreground/[0.02] p-4">{children}</View>
    </View>
  );
}

function CollapsibleSection({
  children,
  expanded,
  icon: Icon,
  onToggle,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  expanded: boolean;
  icon: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  onToggle: () => void;
  subtitle?: string;
  title: string;
}) {
  const colors = useThemeColors();
  return (
    <SectionCard title={title}>
      <TouchableOpacity activeOpacity={0.8} className="flex-row items-center" onPress={onToggle}>
        <View className="mr-3 h-10 w-10 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primarySubtle }}>
          <Icon color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
        </View>
        <View className="flex-1">
          <Text className="text-[15px] font-semibold tracking-tight text-foreground">{title}</Text>
          {subtitle ? (
            <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">{subtitle}</Text>
          ) : null}
        </View>
        {expanded ? (
          <ChevronDown
            color={colors.secondaryText}
            size={18}
            strokeWidth={tokens.icon.strokeWidth}
          />
        ) : (
          <ChevronRight
            color={colors.secondaryText}
            size={18}
            strokeWidth={tokens.icon.strokeWidth}
          />
        )}
      </TouchableOpacity>

      {expanded ? <View className="mt-4">{children}</View> : null}
    </SectionCard>
  );
}

function Field({
  label,
  multiline,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const colors = useThemeColors();
  return (
    <View className="mb-3 last:mb-0">
      <Text className="mb-1.5 px-1 text-[12px] font-medium text-secondary/65">{label}</Text>
      <TextInput
        className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-[15px] text-foreground"
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor={colors.secondaryText}
        style={multiline ? { minHeight: 96, textAlignVertical: 'top' } : undefined}
        value={value}
        onChangeText={onChangeText}
      />
    </View>
  );
}

function ToggleRow({
  description,
  label,
  onValueChange,
  value,
}: {
  description?: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View className="mb-3 flex-row items-center rounded-2xl bg-foreground/[0.04] px-4 py-3 last:mb-0">
      <View className="flex-1 pr-4">
        <Text className="text-[14px] font-semibold text-foreground">{label}</Text>
        {description ? (
          <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">{description}</Text>
        ) : null}
      </View>
      <Switch
        trackColor={{ false: 'rgba(120,120,128,0.18)', true: `${colors.primary}66` }}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function ChoicePill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="rounded-full px-4 py-2"
      style={{ backgroundColor: active ? colors.primary : colors.fillTertiary }}
      onPress={onPress}
    >
      <Text
        className="text-[12px] font-semibold"
        style={{ color: active ? colors.iconOnPrimary : colors.foreground }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ProviderBadge({ logo, providerId }: { logo?: string; providerId?: string }) {
  const colors = useThemeColors();
  const [error, setError] = useState(false);
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const uri = logo || (providerId ? getProviderIconUrl(providerId, effectiveTheme) : undefined);

  if (!providerId) {
    return (
      <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primarySubtle }}>
        <Cpu color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
      </View>
    );
  }

  if (!uri || error) {
    return (
      <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primarySubtle }}>
        <Text className="text-[12px] font-bold" style={{ color: colors.primary }}>
          {providerId.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primarySubtle }}>
      <RNImage
        source={{ uri }}
        style={{ borderRadius: 10, height: 24, width: 24 }}
        onError={() => setError(true)}
      />
    </View>
  );
}

function SkillRow({
  accessory,
  description,
  title,
}: {
  accessory: React.ReactNode;
  description?: string;
  title: React.ReactNode;
}) {
  return (
    <View className="mb-3 flex-row items-center rounded-2xl bg-foreground/[0.03] px-3.5 py-3 last:mb-0">
      <View className="flex-1 pr-3">
        {typeof title === 'string' ? (
          <Text className="text-[14px] font-semibold text-foreground" numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {description ? (
          <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60" numberOfLines={2}>
            {description}
          </Text>
        ) : null}
      </View>
      {accessory}
    </View>
  );
}

function SessionOnlyAgentConfigScreen({ navigation }: { navigation: any }) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const openStore = useCallback(() => {
    const routeNames: string[] = navigation?.getState?.()?.routeNames ?? [];

    if (routeNames.includes('Store')) {
      navigation?.navigate?.('Store');
      return;
    }

    navigation?.navigate?.('MainTabs', { screen: 'Store' });
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 0}
    >
      <ScreenHeader
        rightAccessibilityLabel={t.accessibilityOpenStore}
        title={t.agentConfigTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        rightElement={
          <Save color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
        onPressRight={openStore}
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48, paddingTop: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionCard title={t.agentConfigSessionOnlyTitle}>
          <Text className="text-[15px] leading-6 text-foreground/78">
            {t.agentConfigSessionOnlyDesc}
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            className="mt-4 self-start rounded-xl px-4 py-2.5"
            style={{ backgroundColor: colors.primary }}
            onPress={openStore}
          >
            <Text className="text-[13px] font-semibold" style={{ color: colors.iconOnPrimary }}>{t.agentConfigOpenStore}</Text>
          </TouchableOpacity>
        </SectionCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SessionAgentConfigScreen({
  navigation,
  sessionId,
}: {
  navigation: any;
  sessionId: string;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const modelProviders = useModelStore((s) => s.providers);
  const fetchModels = useModelStore((s) => s.fetchModels);
  const loadSelection = useModelStore((s) => s.loadSelection);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(() => new Set());
  const [skillsVisible, setSkillsVisible] = useState(false);
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [builtinSkillItems, setBuiltinSkillItems] = useState<BuiltinSkillEntry[]>([]);
  const [agentSkillItems, setAgentSkillItems] = useState<AgentSkillItem[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [assistantExpanded, setAssistantExpanded] = useState(true);
  const [conversationExpanded, setConversationExpanded] = useState(true);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  const updateDraft = useCallback(<K extends keyof AgentDraft>(key: K, value: AgentDraft[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }, []);

  const currentProvider = useMemo(
    () => modelProviders.find((provider) => provider.id === draft?.provider),
    [draft?.provider, modelProviders],
  );

  const currentModelLabel = useMemo(() => {
    if (!draft?.model) return t.modelPickerTitle;

    const model =
      currentProvider?.children.find((item) => item.id === draft.model) ||
      modelProviders
        .flatMap((provider) => provider.children)
        .find((item) => item.id === draft.model);

    return model?.displayName || draft.model;
  }, [currentProvider?.children, draft?.model, modelProviders, t.modelPickerTitle]);

  const selectedSkillsSummary =
    selectedSkills.size > 0
      ? t.agentConfigSkillsCount.replace('{count}', String(selectedSkills.size))
      : t.agentConfigSkillsEmpty;

  const conversationSummary = useMemo(() => {
    if (!draft) return undefined;

    const searchLabel =
      draft.searchMode === 'auto' ? t.agentConfigSearchAuto : t.agentConfigSearchOff;
    const memoryLabel = draft.memoryEnabled ? t.memoryToolOnTitle : t.memoryToolOffTitle;

    return `${searchLabel} · ${memoryLabel}`;
  }, [
    draft,
    t.agentConfigSearchAuto,
    t.agentConfigSearchOff,
    t.memoryToolOffTitle,
    t.memoryToolOnTitle,
  ]);

  const advancedSummary = useMemo(() => {
    if (!draft) return undefined;

    const parts: string[] = [];

    if (draft.systemRole.trim()) parts.push(t.agentConfigInstruction);
    if (draft.enableHistoryCount) parts.push(t.agentConfigEnableHistory);
    if (draft.enableAutoCreateTopic) parts.push(t.agentConfigAutoCreateTopic);
    if (draft.temperature.trim() || draft.topP.trim() || draft.maxTokens.trim()) {
      parts.push(t.agentConfigModal);
    }

    return parts.join(' · ') || undefined;
  }, [
    draft,
    t.agentConfigAutoCreateTopic,
    t.agentConfigEnableHistory,
    t.agentConfigInstruction,
    t.agentConfigModal,
  ]);

  const loadSkills = useCallback(async () => {
    setLoadingSkills(true);

    const preloadBuiltins = MOBILE_RECOMMENDED_BUILTIN_SKILLS.map((item) => ({
      description: (t as any)[item.descriptionKey] ?? '',
      icon: item.icon,
      identifier: item.identifier,
      title: (t as any)[item.titleKey] ?? item.identifier,
    }));
    setBuiltinSkillItems(preloadBuiltins);

    try {
      const [plugins, skills, userState] = await Promise.all([
        pluginApi.list(),
        agentSkillApi.list(),
        userApi.getState(),
      ]);

      const uninstalled = userState?.settings?.tool?.uninstalledBuiltinTools ?? [];
      const builtins = MOBILE_RECOMMENDED_BUILTIN_SKILLS.filter(
        (item) => !uninstalled.includes(item.identifier),
      ).map((item) => ({
        description: (t as any)[item.descriptionKey] ?? '',
        icon: item.icon,
        identifier: item.identifier,
        title: (t as any)[item.titleKey] ?? item.identifier,
      }));

      const builtinIds = new Set(builtins.map((item) => item.identifier));
      const filteredSkills = (skills ?? []).filter(
        (skill) => skill.identifier && !builtinIds.has(skill.identifier),
      );
      const skillIds = new Set(filteredSkills.map((item) => item.identifier).filter(Boolean));
      const filteredPlugins = (plugins ?? []).filter(
        (plugin) => !builtinIds.has(plugin.identifier) && !skillIds.has(plugin.identifier),
      );

      setBuiltinSkillItems(builtins);
      setAgentSkillItems(filteredSkills);
      setInstalledPlugins(filteredPlugins);
    } catch {
      toast.show('error', t.errorNetwork);
    } finally {
      setLoadingSkills(false);
    }
  }, [t, toast]);

  const {
    config: agentConfig,
    error: agentConfigError,
    loading: configLoading,
    setConfig,
  } = useAgentConfig(sessionId, true);

  useEffect(() => {
    void fetchModels();
    void loadSelection(sessionId);
  }, [fetchModels, loadSelection, sessionId]);

  useEffect(() => {
    if (agentConfigError) {
      toast.show('error', t.errorNetwork);
      navigation.goBack();
      return;
    }

    if (agentConfig === undefined) {
      setLoading(configLoading);
      return;
    }
    if (!agentConfig?.id) {
      toast.show('error', t.settingsNotConfigured);
      navigation.goBack();
      return;
    }
    setDraft(buildDraft(agentConfig));
    setSelectedSkills(new Set(agentConfig.plugins ?? []));
    setAssistantExpanded(!(agentConfig.title || agentConfig.description || agentConfig.avatar));
    setConversationExpanded(true);
    setAdvancedExpanded(!!agentConfig.systemRole);
    setLoading(false);
  }, [
    agentConfig,
    agentConfigError,
    configLoading,
    navigation,
    t.errorNetwork,
    t.settingsNotConfigured,
    toast,
  ]);

  const toggleSkill = useCallback((identifier: string) => {
    haptics.light();
    setSelectedSkills((current) => {
      const next = new Set(current);
      if (next.has(identifier)) {
        next.delete(identifier);
      } else {
        next.add(identifier);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft?.agentId) return;

    const paramsPatch = Object.fromEntries(
      Object.entries({
        frequency_penalty: normalizeNumber(draft.frequencyPenalty),
        max_tokens: normalizeNumber(draft.maxTokens),
        presence_penalty: normalizeNumber(draft.presencePenalty),
        temperature: normalizeNumber(draft.temperature),
        top_p: normalizeNumber(draft.topP),
      }).filter(([, value]) => value !== undefined),
    );

    try {
      setSaving(true);
      const nextConfig = {
        avatar: normalizeText(draft.avatar),
        chatConfig: {
          autoCreateTopicThreshold: draft.enableAutoCreateTopic
            ? normalizeNumber(draft.autoCreateTopicThreshold)
            : undefined,
          enableAutoCreateTopic: draft.enableAutoCreateTopic,
          enableCompressHistory: draft.enableCompressHistory,
          enableHistoryCount: draft.enableHistoryCount,
          enableStreaming: draft.enableStreaming,
          historyCount: draft.enableHistoryCount ? normalizeNumber(draft.historyCount) : undefined,
          memory: {
            effort: draft.memoryEffort,
            enabled: draft.memoryEnabled,
          },
          searchMode: draft.searchMode,
        },
        description: normalizeText(draft.description),
        id: draft.agentId,
        model: normalizeText(draft.model),
        openingMessage: normalizeText(draft.openingMessage),
        openingQuestions: splitLineList(draft.openingQuestions),
        params: paramsPatch,
        plugins: [...selectedSkills],
        provider: normalizeText(draft.provider),
        systemRole: normalizeText(draft.systemRole),
        title: normalizeText(draft.title),
      };
      await agentApi.updateConfig(draft.agentId, nextConfig);
      if (sessionId) setConfig(nextConfig as any);
      await fetchSessions();
      toast.show('success', t.agentConfigSaved);
      haptics.success();
    } catch {
      toast.show('error', t.errorSaveFailed);
    } finally {
      setSaving(false);
    }
  }, [
    draft,
    fetchSessions,
    selectedSkills,
    sessionId,
    setConfig,
    t.agentConfigSaved,
    t.errorSaveFailed,
    toast,
  ]);

  if (loading || !draft) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          title={t.agentConfigTitle}
          leftElement={
            <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
          }
          onPressLeft={() => navigation.goBack()}
        />
        <ContentSkeleton />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 0}
    >
      <ScreenHeader
        rightAccessibilityHint={t.accessibilityHintSave}
        rightAccessibilityLabel={t.accessibilitySave}
        title={t.agentConfigTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        rightElement={
          saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Save color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
          )
        }
        onPressLeft={() => navigation.goBack()}
        onPressRight={() => void handleSave()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 56, paddingTop: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionCard title={t.agentConfigModal}>
          <TouchableOpacity
            activeOpacity={0.85}
            className="flex-row items-center"
            onPress={() => {
              haptics.light();
              setModelDrawerVisible(true);
            }}
          >
            <ProviderBadge logo={currentProvider?.logo} providerId={draft.provider} />
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-semibold tracking-tight text-foreground">
                {currentModelLabel}
              </Text>
              <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">
                {currentProvider?.name || draft.provider || t.modelPickerTitle}
              </Text>
            </View>
            <ChevronRight
              color={colors.secondaryText}
              size={18}
              strokeWidth={tokens.icon.strokeWidth}
            />
          </TouchableOpacity>
        </SectionCard>

        <SectionCard title={t.skillsTitle}>
          <TouchableOpacity
            activeOpacity={0.85}
            className="flex-row items-center"
            onPress={() => {
              setSkillsVisible(true);
              void loadSkills();
            }}
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primarySubtle }}>
              <Puzzle color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-semibold tracking-tight text-foreground">
                {t.skillsTitle}
              </Text>
              <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">
                {selectedSkillsSummary}
              </Text>
            </View>
            <ChevronRight
              color={colors.secondaryText}
              size={18}
              strokeWidth={tokens.icon.strokeWidth}
            />
          </TouchableOpacity>
        </SectionCard>

        <CollapsibleSection
          expanded={assistantExpanded}
          icon={Bot}
          subtitle={draft.title || draft.description || t.settingsDefaultAgent}
          title={t.agentConfigMeta}
          onToggle={() => setAssistantExpanded((value) => !value)}
        >
          <Field
            label={t.agentConfigName}
            placeholder={t.agentConfigNamePlaceholder}
            value={draft.title}
            onChangeText={(value) => updateDraft('title', value)}
          />
          <Field
            multiline
            label={t.agentConfigDescription}
            placeholder={t.agentConfigDescriptionPlaceholder}
            value={draft.description}
            onChangeText={(value) => updateDraft('description', value)}
          />
          <Field
            label={t.agentConfigAvatar}
            placeholder={t.agentConfigAvatarPlaceholder}
            value={draft.avatar}
            onChangeText={(value) => updateDraft('avatar', value)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          expanded={conversationExpanded}
          icon={MessageSquare}
          subtitle={conversationSummary}
          title={t.agentConfigChats}
          onToggle={() => setConversationExpanded((value) => !value)}
        >
          <View className="mb-3">
            <Text className="mb-2 px-1 text-[12px] font-medium text-secondary/65">
              {t.agentConfigSearchMode}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              <ChoicePill
                active={draft.searchMode === 'off'}
                label={t.agentConfigSearchOff}
                onPress={() => updateDraft('searchMode', 'off')}
              />
              <ChoicePill
                active={draft.searchMode === 'auto'}
                label={t.agentConfigSearchAuto}
                onPress={() => updateDraft('searchMode', 'auto')}
              />
            </View>
          </View>

          <ToggleRow
            description={draft.memoryEnabled ? t.memoryToolOnDesc : t.memoryToolOffDesc}
            label={t.memoryTitle}
            value={draft.memoryEnabled}
            onValueChange={(value) => updateDraft('memoryEnabled', value)}
          />

          {draft.memoryEnabled ? (
            <View className="mb-3">
              <Text className="mb-2 px-1 text-[12px] font-medium text-secondary/65">
                {t.memoryToolEffortTitle}
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                <ChoicePill
                  active={draft.memoryEffort === 'low'}
                  label={t.memoryToolEffortLow}
                  onPress={() => updateDraft('memoryEffort', 'low')}
                />
                <ChoicePill
                  active={draft.memoryEffort === 'medium'}
                  label={t.memoryToolEffortMedium}
                  onPress={() => updateDraft('memoryEffort', 'medium')}
                />
                <ChoicePill
                  active={draft.memoryEffort === 'high'}
                  label={t.memoryToolEffortHigh}
                  onPress={() => updateDraft('memoryEffort', 'high')}
                />
              </View>
            </View>
          ) : null}

          <Field
            multiline
            label={t.agentConfigOpeningMessage}
            value={draft.openingMessage}
            onChangeText={(value) => updateDraft('openingMessage', value)}
          />
          <Field
            multiline
            label={t.agentConfigOpeningQuestions}
            placeholder={t.agentConfigOpeningQuestionsPlaceholder}
            value={draft.openingQuestions}
            onChangeText={(value) => updateDraft('openingQuestions', value)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          expanded={advancedExpanded}
          icon={Settings2}
          subtitle={advancedSummary}
          title={t.agentConfigAdvanced}
          onToggle={() => setAdvancedExpanded((value) => !value)}
        >
          <Field
            multiline
            label={t.agentConfigInstruction}
            placeholder={t.chatSettingsSystemPromptPlaceholder}
            value={draft.systemRole}
            onChangeText={(value) => updateDraft('systemRole', value)}
          />

          <ToggleRow
            label={t.agentConfigAutoCreateTopic}
            value={draft.enableAutoCreateTopic}
            onValueChange={(value) => updateDraft('enableAutoCreateTopic', value)}
          />
          {draft.enableAutoCreateTopic ? (
            <Field
              label={t.agentConfigAutoCreateTopicThreshold}
              value={draft.autoCreateTopicThreshold}
              onChangeText={(value) => updateDraft('autoCreateTopicThreshold', value)}
            />
          ) : null}

          <ToggleRow
            label={t.agentConfigEnableHistory}
            value={draft.enableHistoryCount}
            onValueChange={(value) => updateDraft('enableHistoryCount', value)}
          />
          {draft.enableHistoryCount ? (
            <>
              <Field
                label={t.agentConfigHistoryCount}
                value={draft.historyCount}
                onChangeText={(value) => updateDraft('historyCount', value)}
              />
              <ToggleRow
                label={t.agentConfigCompressHistory}
                value={draft.enableCompressHistory}
                onValueChange={(value) => updateDraft('enableCompressHistory', value)}
              />
            </>
          ) : null}

          <ToggleRow
            label={t.agentConfigStreaming}
            value={draft.enableStreaming}
            onValueChange={(value) => updateDraft('enableStreaming', value)}
          />

          <Field
            label={t.agentConfigTemperature}
            value={draft.temperature}
            onChangeText={(value) => updateDraft('temperature', value)}
          />
          <Field
            label={t.agentConfigTopP}
            value={draft.topP}
            onChangeText={(value) => updateDraft('topP', value)}
          />
          <Field
            label={t.agentConfigPresencePenalty}
            value={draft.presencePenalty}
            onChangeText={(value) => updateDraft('presencePenalty', value)}
          />
          <Field
            label={t.agentConfigFrequencyPenalty}
            value={draft.frequencyPenalty}
            onChangeText={(value) => updateDraft('frequencyPenalty', value)}
          />
          <Field
            label={t.agentConfigMaxTokens}
            value={draft.maxTokens}
            onChangeText={(value) => updateDraft('maxTokens', value)}
          />
        </CollapsibleSection>
      </ScrollView>

      <ModelDrawer
        sessionId={sessionId}
        visible={modelDrawerVisible}
        onClose={() => setModelDrawerVisible(false)}
        onSelect={(modelId, providerId) => {
          updateDraft('model', modelId);
          updateDraft('provider', providerId);
        }}
      />

      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={skillsVisible}
        onRequestClose={() => setSkillsVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setSkillsVisible(false)}
        >
          <Pressable
            className="max-h-[74%] rounded-t-2xl bg-card"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="items-center pt-3 pb-1">
              <View className="h-1 w-9 rounded-full bg-foreground/10" />
            </View>
            <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
              <Text className="text-[18px] font-bold tracking-tight text-foreground">
                {t.skillsTitle}
              </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setSkillsVisible(false)}>
                <Text className="text-[14px] font-semibold" style={{ color: colors.primary }}>{t.done}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 28 }}>
              {loadingSkills ? (
                <View className="items-center py-10">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : builtinSkillItems.length === 0 &&
                agentSkillItems.length === 0 &&
                installedPlugins.length === 0 ? (
                <View className="items-center py-10">
                  <Text className="text-[14px] text-secondary/50">{t.agentConfigSkillsEmpty}</Text>
                </View>
              ) : (
                <>
                  {builtinSkillItems.length > 0 ? (
                    <SectionCard title={t.storeBuiltIn}>
                      {builtinSkillItems.map((item) => (
                        <SkillRow
                          description={item.description}
                          key={`builtin-${item.identifier}`}
                          accessory={
                            <Switch
                              value={selectedSkills.has(item.identifier)}
                              trackColor={{
                                false: 'rgba(120,120,128,0.18)',
                                true: `${colors.primary}66`,
                              }}
                              onValueChange={() => toggleSkill(item.identifier)}
                            />
                          }
                          title={
                            <View className="flex-row items-center">
                              <BuiltinSkillIcon icon={item.icon} size={20} />
                              <Text className="ml-2 text-[14px] font-semibold text-foreground">
                                {item.title}
                              </Text>
                            </View>
                          }
                        />
                      ))}
                    </SectionCard>
                  ) : null}

                  {agentSkillItems.length > 0 ? (
                    <SectionCard title={t.skillsTitle}>
                      {agentSkillItems.map((item) => {
                        const identifier = item.identifier || item.id;
                        return (
                          <SkillRow
                            description={item.description}
                            key={`skill-${identifier}`}
                            title={item.name}
                            accessory={
                              <Switch
                                value={selectedSkills.has(identifier)}
                                trackColor={{
                                  false: 'rgba(120,120,128,0.18)',
                                  true: `${colors.primary}66`,
                                }}
                                onValueChange={() => toggleSkill(identifier)}
                              />
                            }
                          />
                        );
                      })}
                    </SectionCard>
                  ) : null}

                  {installedPlugins.length > 0 ? (
                    <SectionCard title={t.storeInstalled}>
                      {installedPlugins.map((plugin) => (
                        <SkillRow
                          description={plugin.manifest?.meta?.description}
                          key={`plugin-${plugin.identifier}`}
                          accessory={
                            <Switch
                              value={selectedSkills.has(plugin.identifier)}
                              trackColor={{
                                false: 'rgba(120,120,128,0.18)',
                                true: `${colors.primary}66`,
                              }}
                              onValueChange={() => toggleSkill(plugin.identifier)}
                            />
                          }
                          title={
                            <View className="flex-row items-center">
                              <View className="h-6 w-6 items-center justify-center rounded-lg bg-foreground/[0.04]">
                                <Text className="text-[14px]">
                                  {plugin.manifest?.meta?.avatar ?? '🔌'}
                                </Text>
                              </View>
                              <Text className="ml-2 text-[14px] font-semibold text-foreground">
                                {plugin.manifest?.meta?.title || plugin.identifier}
                              </Text>
                            </View>
                          }
                        />
                      ))}
                    </SectionCard>
                  ) : null}
                </>
              )}
            </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
    </KeyboardAvoidingView>
  );
}

function AgentConfigByAgentIdScreen({ agentId, navigation }: { agentId: string; navigation: any }) {
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const modelProviders = useModelStore((s) => s.providers);
  const fetchModels = useModelStore((s) => s.fetchModels);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(() => new Set());
  const [skillsVisible, setSkillsVisible] = useState(false);
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [builtinSkillItems, setBuiltinSkillItems] = useState<BuiltinSkillEntry[]>([]);
  const [agentSkillItems, setAgentSkillItems] = useState<AgentSkillItem[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [assistantExpanded, setAssistantExpanded] = useState(true);
  const [conversationExpanded, setConversationExpanded] = useState(true);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  const updateDraft = useCallback(<K extends keyof AgentDraft>(key: K, value: AgentDraft[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }, []);

  const currentProvider = useMemo(
    () => modelProviders.find((provider) => provider.id === draft?.provider),
    [draft?.provider, modelProviders],
  );

  const currentModelLabel = useMemo(() => {
    if (!draft?.model) return t.modelPickerTitle;

    const model =
      currentProvider?.children.find((item) => item.id === draft.model) ||
      modelProviders
        .flatMap((provider) => provider.children)
        .find((item) => item.id === draft.model);

    return model?.displayName || draft.model;
  }, [currentProvider?.children, draft?.model, modelProviders, t.modelPickerTitle]);

  const selectedSkillsSummary =
    selectedSkills.size > 0
      ? t.agentConfigSkillsCount.replace('{count}', String(selectedSkills.size))
      : t.agentConfigSkillsEmpty;

  const conversationSummary = useMemo(() => {
    if (!draft) return undefined;

    const searchLabel =
      draft.searchMode === 'auto' ? t.agentConfigSearchAuto : t.agentConfigSearchOff;
    const memoryLabel = draft.memoryEnabled ? t.memoryToolOnTitle : t.memoryToolOffTitle;

    return `${searchLabel} · ${memoryLabel}`;
  }, [
    draft,
    t.agentConfigSearchAuto,
    t.agentConfigSearchOff,
    t.memoryToolOffTitle,
    t.memoryToolOnTitle,
  ]);

  const advancedSummary = useMemo(() => {
    if (!draft) return undefined;

    const parts: string[] = [];

    if (draft.systemRole.trim()) parts.push(t.agentConfigInstruction);
    if (draft.enableHistoryCount) parts.push(t.agentConfigEnableHistory);
    if (draft.enableAutoCreateTopic) parts.push(t.agentConfigAutoCreateTopic);
    if (draft.temperature.trim() || draft.topP.trim() || draft.maxTokens.trim()) {
      parts.push(t.agentConfigModal);
    }

    return parts.join(' · ') || undefined;
  }, [
    draft,
    t.agentConfigAutoCreateTopic,
    t.agentConfigEnableHistory,
    t.agentConfigInstruction,
    t.agentConfigModal,
  ]);

  const loadSkills = useCallback(async () => {
    setLoadingSkills(true);

    const preloadBuiltins = MOBILE_RECOMMENDED_BUILTIN_SKILLS.map((item) => ({
      description: (t as any)[item.descriptionKey] ?? '',
      icon: item.icon,
      identifier: item.identifier,
      title: (t as any)[item.titleKey] ?? item.identifier,
    }));
    setBuiltinSkillItems(preloadBuiltins);

    try {
      const [plugins, skills, userState] = await Promise.all([
        pluginApi.list(),
        agentSkillApi.list(),
        userApi.getState(),
      ]);

      const uninstalled = userState?.settings?.tool?.uninstalledBuiltinTools ?? [];
      const builtins = MOBILE_RECOMMENDED_BUILTIN_SKILLS.filter(
        (item) => !uninstalled.includes(item.identifier),
      ).map((item) => ({
        description: (t as any)[item.descriptionKey] ?? '',
        icon: item.icon,
        identifier: item.identifier,
        title: (t as any)[item.titleKey] ?? item.identifier,
      }));

      const builtinIds = new Set(builtins.map((item) => item.identifier));
      const filteredSkills = (skills ?? []).filter(
        (skill) => skill.identifier && !builtinIds.has(skill.identifier),
      );
      const skillIds = new Set(filteredSkills.map((item) => item.identifier).filter(Boolean));
      const filteredPlugins = (plugins ?? []).filter(
        (plugin) => !builtinIds.has(plugin.identifier) && !skillIds.has(plugin.identifier),
      );

      setBuiltinSkillItems(builtins);
      setAgentSkillItems(filteredSkills);
      setInstalledPlugins(filteredPlugins);
    } catch {
      toast.show('error', t.errorNetwork);
    } finally {
      setLoadingSkills(false);
    }
  }, [t, toast]);

  const {
    config: agentConfig,
    error: agentConfigError,
    loading: configLoading,
    setConfig,
  } = useAgentConfigByAgentId(agentId, true);

  useEffect(() => {
    void fetchModels();
  }, [fetchModels]);

  useEffect(() => {
    if (agentConfigError) {
      toast.show('error', t.errorNetwork);
      navigation.goBack();
      return;
    }

    if (agentConfig === undefined) {
      setLoading(configLoading);
      return;
    }
    if (!agentConfig?.id) {
      toast.show('error', t.settingsNotConfigured);
      navigation.goBack();
      return;
    }
    setDraft(buildDraft(agentConfig));
    setSelectedSkills(new Set(agentConfig.plugins ?? []));
    setAssistantExpanded(!(agentConfig.title || agentConfig.description || agentConfig.avatar));
    setConversationExpanded(true);
    setAdvancedExpanded(!!agentConfig.systemRole);
    setLoading(false);
  }, [
    agentConfig,
    agentConfigError,
    configLoading,
    navigation,
    t.errorNetwork,
    t.settingsNotConfigured,
    toast,
  ]);

  const toggleSkill = useCallback((identifier: string) => {
    haptics.light();
    setSelectedSkills((current) => {
      const next = new Set(current);
      if (next.has(identifier)) {
        next.delete(identifier);
      } else {
        next.add(identifier);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!draft?.agentId) return;

    const paramsPatch = Object.fromEntries(
      Object.entries({
        frequency_penalty: normalizeNumber(draft.frequencyPenalty),
        max_tokens: normalizeNumber(draft.maxTokens),
        presence_penalty: normalizeNumber(draft.presencePenalty),
        temperature: normalizeNumber(draft.temperature),
        top_p: normalizeNumber(draft.topP),
      }).filter(([, value]) => value !== undefined),
    );

    try {
      setSaving(true);
      const nextConfig = {
        avatar: normalizeText(draft.avatar),
        chatConfig: {
          autoCreateTopicThreshold: draft.enableAutoCreateTopic
            ? normalizeNumber(draft.autoCreateTopicThreshold)
            : undefined,
          enableAutoCreateTopic: draft.enableAutoCreateTopic,
          enableCompressHistory: draft.enableCompressHistory,
          enableHistoryCount: draft.enableHistoryCount,
          enableStreaming: draft.enableStreaming,
          historyCount: draft.enableHistoryCount ? normalizeNumber(draft.historyCount) : undefined,
          memory: {
            effort: draft.memoryEffort,
            enabled: draft.memoryEnabled,
          },
          searchMode: draft.searchMode,
        },
        description: normalizeText(draft.description),
        id: draft.agentId,
        model: normalizeText(draft.model),
        openingMessage: normalizeText(draft.openingMessage),
        openingQuestions: splitLineList(draft.openingQuestions),
        params: paramsPatch,
        plugins: [...selectedSkills],
        provider: normalizeText(draft.provider),
        systemRole: normalizeText(draft.systemRole),
        title: normalizeText(draft.title),
      };
      await agentApi.updateConfig(draft.agentId, nextConfig);
      setConfig(nextConfig as any);
      toast.show('success', t.agentConfigSaved);
      haptics.success();
    } catch {
      toast.show('error', t.errorSaveFailed);
    } finally {
      setSaving(false);
    }
  }, [draft, selectedSkills, setConfig, t.agentConfigSaved, t.errorSaveFailed, toast]);

  if (loading || !draft) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          title={t.agentConfigTitle}
          leftElement={
            <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
          }
          onPressLeft={() => navigation.goBack()}
        />
        <ContentSkeleton />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 0}
    >
      <ScreenHeader
        rightAccessibilityHint={t.accessibilityHintSave}
        rightAccessibilityLabel={t.accessibilitySave}
        title={t.agentConfigTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        rightElement={
          saving ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Save color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
          )
        }
        onPressLeft={() => navigation.goBack()}
        onPressRight={() => void handleSave()}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 56, paddingTop: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        <SectionCard title={t.agentConfigModal}>
          <TouchableOpacity
            activeOpacity={0.85}
            className="flex-row items-center"
            onPress={() => {
              haptics.light();
              setModelDrawerVisible(true);
            }}
          >
            <ProviderBadge logo={currentProvider?.logo} providerId={draft.provider} />
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-semibold tracking-tight text-foreground">
                {currentModelLabel}
              </Text>
              <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">
                {currentProvider?.name || draft.provider || t.modelPickerTitle}
              </Text>
            </View>
            <ChevronRight
              color={colors.secondaryText}
              size={18}
              strokeWidth={tokens.icon.strokeWidth}
            />
          </TouchableOpacity>
        </SectionCard>

        <SectionCard title={t.skillsTitle}>
          <TouchableOpacity
            activeOpacity={0.85}
            className="flex-row items-center"
            onPress={() => {
              setSkillsVisible(true);
              void loadSkills();
            }}
          >
            <View className="h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primarySubtle }}>
              <Puzzle color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-[15px] font-semibold tracking-tight text-foreground">
                {t.skillsTitle}
              </Text>
              <Text className="mt-0.5 text-[12px] leading-5 text-secondary/60">
                {selectedSkillsSummary}
              </Text>
            </View>
            <ChevronRight
              color={colors.secondaryText}
              size={18}
              strokeWidth={tokens.icon.strokeWidth}
            />
          </TouchableOpacity>
        </SectionCard>

        <CollapsibleSection
          expanded={assistantExpanded}
          icon={Bot}
          subtitle={draft.title || draft.description || t.settingsDefaultAgent}
          title={t.agentConfigMeta}
          onToggle={() => setAssistantExpanded((value) => !value)}
        >
          <Field
            label={t.agentConfigName}
            placeholder={t.agentConfigNamePlaceholder}
            value={draft.title}
            onChangeText={(value) => updateDraft('title', value)}
          />
          <Field
            multiline
            label={t.agentConfigDescription}
            placeholder={t.agentConfigDescriptionPlaceholder}
            value={draft.description}
            onChangeText={(value) => updateDraft('description', value)}
          />
          <Field
            label={t.agentConfigAvatar}
            placeholder={t.agentConfigAvatarPlaceholder}
            value={draft.avatar}
            onChangeText={(value) => updateDraft('avatar', value)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          expanded={conversationExpanded}
          icon={MessageSquare}
          subtitle={conversationSummary}
          title={t.agentConfigChats}
          onToggle={() => setConversationExpanded((value) => !value)}
        >
          <View className="mb-3">
            <Text className="mb-2 px-1 text-[12px] font-medium text-secondary/65">
              {t.agentConfigSearchMode}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              <ChoicePill
                active={draft.searchMode === 'off'}
                label={t.agentConfigSearchOff}
                onPress={() => updateDraft('searchMode', 'off')}
              />
              <ChoicePill
                active={draft.searchMode === 'auto'}
                label={t.agentConfigSearchAuto}
                onPress={() => updateDraft('searchMode', 'auto')}
              />
            </View>
          </View>
          <View className="mb-3">
            <Text className="mb-2 px-1 text-[12px] font-medium text-secondary/65">
              {t.memoryToolTitle}
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              <ChoicePill
                active={!draft.memoryEnabled}
                label={t.memoryToolOffTitle}
                onPress={() => updateDraft('memoryEnabled', false)}
              />
              <ChoicePill
                active={draft.memoryEnabled}
                label={t.memoryToolOnTitle}
                onPress={() => updateDraft('memoryEnabled', true)}
              />
            </View>
          </View>
          <ToggleRow
            label={t.agentConfigMemoryEffort}
            value={draft.memoryEffort}
            onValueChange={(v) => updateDraft('memoryEffort', v)}
          />
        </CollapsibleSection>

        <CollapsibleSection
          expanded={advancedExpanded}
          icon={Cpu}
          subtitle={advancedSummary}
          title={t.agentConfigAdvanced}
          onToggle={() => setAdvancedExpanded((value) => !value)}
        >
          <Field
            multiline
            label={t.agentConfigInstruction}
            placeholder={t.agentConfigInstructionPlaceholder}
            value={draft.systemRole}
            onChangeText={(value) => updateDraft('systemRole', value)}
          />
          <Field
            label={t.agentConfigOpeningMessage}
            placeholder={t.agentConfigOpeningPlaceholder}
            value={draft.openingMessage}
            onChangeText={(value) => updateDraft('openingMessage', value)}
          />
          <Field
            multiline
            label={t.agentConfigOpeningQuestions}
            placeholder={t.agentConfigOpeningQuestionsPlaceholder}
            value={draft.openingQuestions}
            onChangeText={(value) => updateDraft('openingQuestions', value)}
          />
          <ToggleRow
            label={t.agentConfigEnableHistory}
            value={draft.enableHistoryCount}
            onValueChange={(v) => updateDraft('enableHistoryCount', v)}
          />
          <Field
            label={t.agentConfigHistoryCount}
            value={draft.historyCount}
            onChangeText={(value) => updateDraft('historyCount', value)}
          />
          <ToggleRow
            label={t.agentConfigCompressHistory}
            value={draft.enableCompressHistory}
            onValueChange={(v) => updateDraft('enableCompressHistory', v)}
          />
          <ToggleRow
            label={t.agentConfigAutoCreateTopic}
            value={draft.enableAutoCreateTopic}
            onValueChange={(v) => updateDraft('enableAutoCreateTopic', v)}
          />
          <Field
            label={t.agentConfigAutoCreateTopicThreshold}
            value={draft.autoCreateTopicThreshold}
            onChangeText={(value) => updateDraft('autoCreateTopicThreshold', value)}
          />
          <ToggleRow
            label={t.agentConfigStreaming}
            value={draft.enableStreaming}
            onValueChange={(v) => updateDraft('enableStreaming', v)}
          />
          <Field
            label={t.agentConfigTemperature}
            value={draft.temperature}
            onChangeText={(value) => updateDraft('temperature', value)}
          />
          <Field
            label={t.agentConfigTopP}
            value={draft.topP}
            onChangeText={(value) => updateDraft('topP', value)}
          />
          <Field
            label={t.agentConfigPresencePenalty}
            value={draft.presencePenalty}
            onChangeText={(value) => updateDraft('presencePenalty', value)}
          />
          <Field
            label={t.agentConfigFrequencyPenalty}
            value={draft.frequencyPenalty}
            onChangeText={(value) => updateDraft('frequencyPenalty', value)}
          />
          <Field
            label={t.agentConfigMaxTokens}
            value={draft.maxTokens}
            onChangeText={(value) => updateDraft('maxTokens', value)}
          />
        </CollapsibleSection>
      </ScrollView>

      <ModelDrawer
        initialModel={draft.model}
        initialProvider={draft.provider}
        persistSelection={false}
        visible={modelDrawerVisible}
        onClose={() => setModelDrawerVisible(false)}
        onSelect={(modelId, providerId) => {
          updateDraft('model', modelId);
          updateDraft('provider', providerId);
        }}
      />

      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={skillsVisible}
        onRequestClose={() => setSkillsVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setSkillsVisible(false)}
        >
          <Pressable
            className="max-h-[74%] rounded-t-2xl bg-card"
            onPress={(event) => event.stopPropagation()}
          >
            <View className="items-center pt-3 pb-1">
              <View className="h-1 w-9 rounded-full bg-foreground/10" />
            </View>
            <View className="flex-row items-center justify-between px-5 pb-3 pt-2">
              <Text className="text-[18px] font-bold tracking-tight text-foreground">
                {t.skillsTitle}
              </Text>
              <TouchableOpacity activeOpacity={0.7} onPress={() => setSkillsVisible(false)}>
                <Text className="text-[14px] font-semibold" style={{ color: colors.primary }}>{t.done}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 28 }}>
              {loadingSkills ? (
                <View className="items-center py-10">
                  <ActivityIndicator color={colors.primary} />
                </View>
              ) : builtinSkillItems.length === 0 &&
                agentSkillItems.length === 0 &&
                installedPlugins.length === 0 ? (
                <View className="items-center py-10">
                  <Text className="text-[14px] text-secondary/50">{t.agentConfigSkillsEmpty}</Text>
                </View>
              ) : (
                <>
                  {builtinSkillItems.length > 0 ? (
                    <SectionCard title={t.storeBuiltIn}>
                      {builtinSkillItems.map((item) => (
                        <SkillRow
                          description={item.description}
                          key={`builtin-${item.identifier}`}
                          accessory={
                            <Switch
                              value={selectedSkills.has(item.identifier)}
                              trackColor={{
                                false: 'rgba(120,120,128,0.18)',
                                true: `${colors.primary}66`,
                              }}
                              onValueChange={() => toggleSkill(item.identifier)}
                            />
                          }
                          title={
                            <View className="flex-row items-center">
                              <BuiltinSkillIcon icon={item.icon} size={20} />
                              <Text className="ml-2 text-[14px] font-semibold text-foreground">
                                {(t as any)[item.titleKey] ?? item.identifier}
                              </Text>
                            </View>
                          }
                        />
                      ))}
                    </SectionCard>
                  ) : null}
                  {agentSkillItems.length > 0 ? (
                    <SectionCard title={t.storeInstalled}>
                      {agentSkillItems.map((item) => (
                        <SkillRow
                          description={item.description}
                          key={`skill-${item.id}`}
                          accessory={
                            <Switch
                              value={selectedSkills.has(item.identifier ?? '')}
                              trackColor={{
                                false: 'rgba(120,120,128,0.18)',
                                true: `${colors.primary}66`,
                              }}
                              onValueChange={() => toggleSkill(item.identifier ?? '')}
                            />
                          }
                          title={
                            <View className="flex-row items-center">
                              <BuiltinSkillIcon icon={(item as any).icon || 'puzzle'} size={20} />
                              <Text className="ml-2 text-[14px] font-semibold text-foreground">
                                {item.title || item.identifier}
                              </Text>
                            </View>
                          }
                        />
                      ))}
                    </SectionCard>
                  ) : null}
                  {installedPlugins.length > 0 ? (
                    <SectionCard title={t.storePlugins}>
                      {installedPlugins.map((item) => (
                        <SkillRow
                          description={item.description}
                          key={`plugin-${item.identifier}`}
                          accessory={
                            <Switch
                              value={selectedSkills.has(item.identifier)}
                              trackColor={{
                                false: 'rgba(120,120,128,0.18)',
                                true: `${colors.primary}66`,
                              }}
                              onValueChange={() => toggleSkill(item.identifier)}
                            />
                          }
                          title={
                            <View className="flex-row items-center">
                              <ProviderBadge logo={item.logo} providerId={item.identifier} />
                              <Text className="ml-2 text-[14px] font-semibold text-foreground">
                                {item.meta?.title || item.identifier}
                              </Text>
                            </View>
                          }
                        />
                      ))}
                    </SectionCard>
                  ) : null}
                </>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

export default function AgentConfigScreen({ navigation, route }: any) {
  const sessionId = route.params?.sessionId as string | undefined;
  const agentId = route.params?.agentId as string | undefined;

  if (sessionId) {
    return <SessionAgentConfigScreen navigation={navigation} sessionId={sessionId} />;
  }

  if (agentId) {
    return <AgentConfigByAgentIdScreen agentId={agentId} navigation={navigation} />;
  }

  return <SessionOnlyAgentConfigScreen navigation={navigation} />;
}
