/**
 * ProfileScreen → Workspace Control Center
 *
 * Layout:
 *  - WorkspaceOverviewCard: Identity, Model, Providers
 *  - Usage Stats, Memory, Agents, Notebook
 *  - Settings: Server, AI Providers, Model, Language, Theme, Color, Memory config, Data, Voice
 *  - Sign Out
 */
import { useFocusEffect } from '@react-navigation/native';
import {
  BarChart3,
  Bot,
  Brain,
  BrainCircuit,
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Cloud,
  Database,
  FileText,
  Globe,
  Key,
  LogOut,
  Mic,
  Monitor,
  Moon,
  Palette,
  Server,
  Settings2,
  Sun,
  Volume2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import LanguageSheet from '../components/ui/LanguageSheet';
import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SettingsSection } from '../components/ui/SettingsLayout';
import { useToast } from '../components/ui/Toast';
import { WorkspaceOverviewCard } from '../components/ui/WorkspaceOverviewCard';
import { aiProviderApi, statsApi, userApi } from '../lib/api';
import { APP_NAME, APP_VERSION } from '../lib/appInfo';
import { clearTransientAppState } from '../lib/appState';
import { signOutFromBrowser } from '../lib/auth';
import { useMainTabScrollableContentPaddingBottom } from '../lib/bottomChrome';
import { joinWebPath } from '../lib/communityLinks';
import { haptics } from '../lib/haptics';
import { LOCALE_DISPLAY_NAMES, useI18n } from '../lib/i18n';
import { getAppLoggingEnabled, setAppLoggingEnabled } from '../lib/logger';
import { getApiUrl } from '../lib/server';
import { useAgentStore } from '../store/agent';
import { useConnectionStore } from '../store/connection';
import { useSessionStore } from '../store/session';
import { type ThemePreference, useThemeStore } from '../store/theme';
import {
  DEFAULT_USER_MEMORY_SETTINGS,
  getUserMemorySettings,
  setCachedUserMemorySettings,
  useUserStore,
} from '../store/user';
import { useThemeColors } from '../theme/colors';
import { enteringSection } from '../theme/motion';
import { COLOR_SCHEMES, type ColorSchemeId } from '../theme/palettes';
import { tokens } from '../theme/tokens';
import type { MobileMemoryEffort } from '../types';

const THEME_OPTIONS: { icon: typeof Sun; value: ThemePreference }[] = [
  { icon: Sun, value: 'light' },
  { icon: Moon, value: 'dark' },
  { icon: Monitor, value: 'system' },
];

const COLOR_SCHEME_ORDER: ColorSchemeId[] = [
  'blue',
  'amber',
  'violet',
  'green',
  'slate',
  'rose',
  'sage',
  'dustBlue',
];

const COLOR_SCHEME_OPTIONS: { color: string; value: ColorSchemeId }[] = COLOR_SCHEME_ORDER.map(
  (value) => ({ color: COLOR_SCHEMES[value].primary, value }),
);

const getColorSchemeLabel = (
  value: ColorSchemeId,
  t: {
    themeColorAmber: string;
    themeColorBlue: string;
    themeColorDustBlue: string;
    themeColorGreen: string;
    themeColorRose: string;
    themeColorSage: string;
    themeColorSlate: string;
    themeColorViolet: string;
  },
) => {
  if (value === 'blue') return t.themeColorBlue;
  if (value === 'amber') return t.themeColorAmber;
  if (value === 'violet') return t.themeColorViolet;
  if (value === 'green') return t.themeColorGreen;
  if (value === 'slate') return t.themeColorSlate;
  if (value === 'rose') return t.themeColorRose;
  if (value === 'sage') return t.themeColorSage;
  if (value === 'dustBlue') return t.themeColorDustBlue;
  return t.themeColorBlue;
};

const getThemeLabel = (
  value: ThemePreference,
  t: { themeDark: string; themeLight: string; themeSystem: string },
) => {
  if (value === 'light') return t.themeLight;
  if (value === 'dark') return t.themeDark;
  return t.themeSystem;
};

export default function ProfileScreen({ navigation }: any) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const scrollPaddingBottom = useMainTabScrollableContentPaddingBottom();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const setColorScheme = useThemeStore((s) => s.setColorScheme);
  const sessionCount = useSessionStore((s) => s.sessions.length);
  const isConnected = useConnectionStore((s) => s.isConnected);
  const serverUrl = useConnectionStore((s) => s.serverUrl);
  const checking = useConnectionStore((s) => s.checking);
  const checkConnection = useConnectionStore((s) => s.checkConnection);

  const userAvatar = useUserStore((s) => s.avatar);
  const userEmail = useUserStore((s) => s.email);
  const userFullName = useUserStore((s) => s.fullName);
  const userId = useUserStore((s) => s.profile?.id);
  const username = useUserStore((s) => s.username);
  const fetchUser = useUserStore((s) => s.fetchUser);
  const isUserLoaded = useUserStore((s) => s.isLoaded);
  const userName = userFullName || username || userEmail;

  const [messageCount, setMessageCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [providerCount, setProviderCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(DEFAULT_USER_MEMORY_SETTINGS.enabled);
  const [memoryEffort, setMemoryEffort] = useState<MobileMemoryEffort>(
    DEFAULT_USER_MEMORY_SETTINGS.effort,
  );
  const [memoryLoading, setMemoryLoading] = useState(true);
  const [memorySaving, setMemorySaving] = useState(false);
  const [languageSheetVisible, setLanguageSheetVisible] = useState(false);
  const [displayServerUrl, setDisplayServerUrl] = useState('');
  const [loggingEnabled, setLoggingEnabledState] = useState(false);
  const [dataComingSoonExpanded, setDataComingSoonExpanded] = useState(false);

  useEffect(() => {
    if (serverUrl) {
      setDisplayServerUrl(serverUrl);
    } else {
      getApiUrl().then(setDisplayServerUrl);
    }
  }, [serverUrl]);

  useEffect(() => {
    setLoggingEnabledState(getAppLoggingEnabled());
  }, []);

  const memoryEffortOptions = useMemo<Array<{ label: string; value: MobileMemoryEffort }>>(
    () => [
      { label: t.memoryToolEffortLow, value: 'low' },
      { label: t.memoryToolEffortMedium, value: 'medium' },
      { label: t.memoryToolEffortHigh, value: 'high' },
    ],
    [t.memoryToolEffortHigh, t.memoryToolEffortLow, t.memoryToolEffortMedium],
  );

  const [defaultModel, setDefaultModel] = useState<string>('');

  const serverDisplay = useMemo(() => {
    if (!displayServerUrl) return '';

    try {
      const parsed = new URL(displayServerUrl);
      return parsed.host || displayServerUrl;
    } catch {
      return displayServerUrl;
    }
  }, [displayServerUrl]);

  const loadDefaultModel = useCallback(async () => {
    try {
      const userState = await userApi.getState();
      const model = userState?.settings?.defaultAgent?.config?.model;
      setDefaultModel(typeof model === 'string' ? model : '');
    } catch {
      setDefaultModel('');
    }
  }, []);

  const loadStats = useCallback(async () => {
    const [msgs, topics, providers] = await Promise.all([
      statsApi.countMessages().catch(() => 0),
      statsApi.countTopics().catch(() => 0),
      aiProviderApi
        .list()
        .then((list) => (list ?? []).filter((p: any) => p.enabled).length)
        .catch(() => 0),
    ]);
    setMessageCount(msgs as number);
    setTopicCount(topics as number);
    setProviderCount(providers as number);
  }, []);

  const loadMemorySettings = useCallback(async () => {
    setMemoryLoading(true);
    try {
      const settings = await getUserMemorySettings({ force: true });
      setMemoryEnabled(settings.enabled);
      setMemoryEffort(settings.effort);
    } finally {
      setMemoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    if (!isUserLoaded) fetchUser();
    if (!useAgentStore.getState().initialized) {
      void useAgentStore.getState().loadAgents();
    }
  }, [loadStats, isUserLoaded, fetchUser]);

  useFocusEffect(
    useCallback(() => {
      checkConnection();
      void fetchUser();
      void loadMemorySettings();
      void loadDefaultModel();
      setLoggingEnabledState(getAppLoggingEnabled());
      if (!useAgentStore.getState().initialized) {
        void useAgentStore.getState().loadAgents();
      }
    }, [checkConnection, fetchUser, loadMemorySettings, loadDefaultModel]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await Promise.all([
      loadStats(),
      checkConnection(),
      fetchUser(),
      loadMemorySettings(),
      loadDefaultModel(),
    ]);
    setRefreshing(false);
  }, [loadStats, checkConnection, fetchUser, loadMemorySettings, loadDefaultModel]);

  const handleToggleLogging = useCallback(
    async (value: boolean) => {
      setLoggingEnabledState(value);
      await setAppLoggingEnabled(value);
      toast.show('success', value ? t.logsEnabled : t.logsDisabled);
    },
    [t.logsDisabled, t.logsEnabled, toast],
  );

  useEffect(() => {
    void loadMemorySettings();
  }, [loadMemorySettings]);

  const updateMemorySettings = useCallback(
    async (nextEnabled: boolean, nextEffort: MobileMemoryEffort) => {
      if (memorySaving) return;
      const prevEnabled = memoryEnabled;
      const prevEffort = memoryEffort;
      setMemoryEnabled(nextEnabled);
      setMemoryEffort(nextEffort);
      setMemorySaving(true);
      try {
        await userApi.updateSettings({
          memory: { effort: nextEffort, enabled: nextEnabled },
        });
        setCachedUserMemorySettings({ effort: nextEffort, enabled: nextEnabled });
      } catch {
        setMemoryEnabled(prevEnabled);
        setMemoryEffort(prevEffort);
        toast.show('error', t.errorSaveFailed);
      } finally {
        setMemorySaving(false);
      }
    },
    [memoryEffort, memoryEnabled, memorySaving, t.errorSaveFailed, toast],
  );

  const safeNavigate = (name: string) => {
    haptics.light();
    navigation?.navigate?.(name);
  };

  const handleOpenWebPath = useCallback(
    async (path: `/${string}`) => {
      haptics.light();
      try {
        const baseUrl = await getApiUrl();
        await Linking.openURL(joinWebPath(baseUrl, path));
      } catch {
        toast.show('error', t.settingsOpenWebFailed);
      }
    },
    [t.settingsOpenWebFailed, toast],
  );

  const advancedWebEntries = useMemo(
    () => [
      {
        description: t.settingsOpenWebSettingsDesc,
        icon: Settings2,
        label: t.settingsOpenWebSettings,
        path: '/settings' as const,
      },
      {
        description: t.settingsOpenWebStudioDesc,
        icon: BrainCircuit,
        label: t.settingsOpenWebStudio,
        path: '/studio' as const,
      },
      {
        description: t.settingsOpenWebMcpStudioDesc,
        icon: Bot,
        label: t.settingsOpenWebMcpStudio,
        path: '/settings/mcp-studio' as const,
      },
      {
        description: t.settingsOpenWebImageDesc,
        icon: Palette,
        label: t.settingsOpenWebImage,
        path: '/image' as const,
      },
      {
        description: t.settingsOpenWebVideoDesc,
        icon: Clapperboard,
        label: t.settingsOpenWebVideo,
        path: '/video' as const,
      },
    ],
    [
      t.settingsOpenWebImage,
      t.settingsOpenWebImageDesc,
      t.settingsOpenWebMcpStudio,
      t.settingsOpenWebMcpStudioDesc,
      t.settingsOpenWebSettings,
      t.settingsOpenWebSettingsDesc,
      t.settingsOpenWebStudio,
      t.settingsOpenWebStudioDesc,
      t.settingsOpenWebVideo,
      t.settingsOpenWebVideoDesc,
    ],
  );

  const handleSignOut = () => {
    Alert.alert(t.meSignOutConfirm, t.meSignOutDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.meSignOut,
        style: 'destructive',
        onPress: async () => {
          toast.mute(4000);
          try {
            const baseUrl = await getApiUrl();
            await signOutFromBrowser(baseUrl);
            await clearTransientAppState();
            navigation?.reset?.({
              index: 0,
              routes: [{ name: 'Login' }],
            });
          } catch {
            // Logging out should stay quiet even if the browser handoff closes early.
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        headerLevel="root"
        subtitle={t.settingsHeaderSubtitle}
        title={t.settingsTitle ?? 'Settings'}
      />

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: scrollPaddingBottom,
        }}
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={onRefresh}
          />
        }
      >
        {/* Workspace Overview — taps into profile / model / providers */}
        <Animated.View entering={enteringSection(50)}>
          <View className="pt-2">
            <WorkspaceOverviewCard
              defaultModel={defaultModel || t.settingsNotConfigured}
              isConnected={isConnected}
              providerCount={providerCount}
              serverDisplay={serverDisplay}
              userAvatar={userAvatar}
              userId={userId}
              userName={userName || t.meUser || 'User'}
              onPress={() => navigation?.navigate?.('ProfileEdit')}
              onPressModel={() => navigation?.navigate?.('ModelPicker')}
              onPressProviders={() => navigation?.navigate?.('AIProviders')}
            />
          </View>
        </Animated.View>

        {/* Workspace — Stats, Memory, Agents, Notebook */}
        <SettingsSection delay={80} title={t.settingsGroupWorkspace}>
          <View className="mb-4">
            <PressableScale
              className="overflow-hidden rounded-xl px-5 pt-4 pb-4"
              style={{
                backgroundColor: colors.fillQuaternary,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
              }}
              onPress={() => navigation?.navigate?.('Stats')}
            >
              <View className="flex-row items-center mb-4">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-4"
                  style={{ backgroundColor: colors.primarySubtle }}
                >
                  <BarChart3
                    color={colors.primary}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.statsTitle}
                  </Text>
                  <Text
                    className="text-[12px] font-medium mt-0.5"
                    style={{ color: colors.secondaryText }}
                  >
                    {t.statsOverview}
                  </Text>
                </View>
                <ChevronRight
                  color={colors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </View>
              <View className="flex-row gap-3">
                <View
                  className="flex-1 rounded-xl px-3.5 py-3"
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.borderSubtle,
                    borderWidth: 1,
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                    style={{ color: colors.primary }}
                  >
                    {t.statsMessages}
                  </Text>
                  <Text className="text-foreground text-[17px] font-bold tracking-tight">
                    {messageCount}
                  </Text>
                </View>
                <View
                  className="flex-1 rounded-xl px-3.5 py-3"
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.borderSubtle,
                    borderWidth: 1,
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                    style={{ color: colors.primary }}
                  >
                    {t.statsSessions}
                  </Text>
                  <Text className="text-foreground text-[17px] font-bold tracking-tight">
                    {sessionCount}
                  </Text>
                </View>
                <View
                  className="flex-1 rounded-xl px-3.5 py-3"
                  style={{
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.borderSubtle,
                    borderWidth: 1,
                  }}
                >
                  <Text
                    className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                    style={{ color: colors.primary }}
                  >
                    {t.statsTotalTopics}
                  </Text>
                  <Text className="text-foreground text-[17px] font-bold tracking-tight">
                    {topicCount}
                  </Text>
                </View>
              </View>
            </PressableScale>
          </View>

          <View className="mb-4">
            <View
              className="rounded-xl px-5 py-4"
              style={{
                backgroundColor: colors.fillQuaternary,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
              }}
            >
              <View className="mb-4 flex-row items-center">
                <View
                  className="mr-4 h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.primarySubtle }}
                >
                  <BrainCircuit
                    color={colors.primary}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.memoryTitle}
                  </Text>
                  <Text
                    className="text-[12px] font-medium mt-0.5"
                    style={{ color: colors.secondaryText }}
                  >
                    {t.memoryDesc}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.75}
                  className="h-9 w-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: colors.surfaceElevated }}
                  onPress={() => navigation?.navigate?.('Memory')}
                >
                  <ChevronRight
                    color={colors.primary}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </TouchableOpacity>
              </View>

              <View
                className="flex-row items-center rounded-xl px-4 py-3"
                style={{
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                }}
              >
                <View className="flex-1 pr-4">
                  <Text className="text-foreground text-[14px] font-medium tracking-tight">
                    {memoryEnabled ? t.memoryToolOnTitle : t.memoryToolOffTitle}
                  </Text>
                  <Text
                    className="mt-0.5 text-[12px] font-medium"
                    style={{ color: colors.secondaryText }}
                  >
                    {memoryEnabled ? t.memoryToolOnDesc : t.memoryToolOffDesc}
                  </Text>
                </View>
                {memoryLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Switch
                    accessibilityHint={t.memoryDesc}
                    accessibilityLabel={t.memoryTitle}
                    disabled={memorySaving}
                    value={memoryEnabled}
                    trackColor={{
                      false: colors.switchTrackOffAlt,
                      true: `${colors.switchTrackOn}66`,
                    }}
                    onValueChange={(value) => {
                      haptics.light();
                      void updateMemorySettings(value, memoryEffort);
                    }}
                  />
                )}
              </View>

              <View className="mt-3 flex-row gap-2">
                {memoryEffortOptions.map((opt) => {
                  const active = memoryEffort === opt.value;
                  return (
                    <Pressable
                      className="flex-1 flex-row items-center justify-center rounded-xl px-3 py-2.5"
                      disabled={memoryLoading || memorySaving || !memoryEnabled}
                      key={opt.value}
                      style={{
                        backgroundColor: active ? colors.primarySubtle : colors.fillTertiary,
                      }}
                      onPress={() => {
                        if (active) return;
                        haptics.selection();
                        void updateMemorySettings(memoryEnabled, opt.value);
                      }}
                    >
                      {active ? (
                        <Check
                          color={colors.primary}
                          size={14}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      ) : null}
                      <Text
                        className="ml-1.5 text-[13px] font-medium"
                        style={{ color: active ? colors.primary : colors.secondaryText }}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View className="mb-4">
            <PressableScale
              className="flex-row items-center rounded-xl px-5 py-3.5"
              style={{
                backgroundColor: colors.fillQuaternary,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
              }}
              onPress={() => navigation?.navigate?.('AgentList')}
            >
              <View
                className="mr-4 h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.primarySubtle }}
              >
                <Bot color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.meAgents}
                </Text>
                <Text
                  className="text-[12px] font-medium mt-0.5"
                  style={{ color: colors.secondaryText }}
                >
                  {t.meAgentsDesc}
                </Text>
              </View>
              <ChevronRight
                color={colors.primary}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </PressableScale>
          </View>

          <View className="mb-4">
            <PressableScale
              className="flex-row items-center rounded-xl px-5 py-3.5"
              style={{
                backgroundColor: colors.fillQuaternary,
                borderColor: colors.borderSubtle,
                borderWidth: 1,
              }}
              onPress={() => navigation?.navigate?.('Notebook', {})}
            >
              <View
                className="mr-4 h-8 w-8 items-center justify-center rounded-full"
                style={{ backgroundColor: colors.primarySubtle }}
              >
                <FileText color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.notebookTitle}
                </Text>
                <Text
                  className="text-[12px] font-medium mt-0.5"
                  style={{ color: colors.secondaryText }}
                >
                  {t.notebookDesc}
                </Text>
              </View>
              <ChevronRight
                color={colors.primary}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </PressableScale>
          </View>
        </SettingsSection>

        {/* Connection & AI — Server, Providers, Model */}
        <SettingsSection
          delay={105}
          description={t.settingsConnectionAlsoInOverview}
          title={t.settingsGroupConnection}
        >
          <View className="mb-4">
            <View className="rounded-xl bg-foreground/[0.03] overflow-hidden">
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-3.5"
                onPress={() => safeNavigate('ServerConfig')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Server color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsServerConfig}
                  </Text>
                  <View className="mt-0.5 flex-row items-center gap-2">
                    {checking ? (
                      <ActivityIndicator color={colors.primary} size="small" />
                    ) : (
                      <View
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: isConnected ? colors.primary : colors.tertiaryText,
                        }}
                      />
                    )}
                    <Text
                      className="flex-1 text-[12px] font-medium"
                      numberOfLines={1}
                      style={{ color: colors.secondaryText }}
                    >
                      {checking ? t.serverTesting : displayServerUrl || t.settingsServerConfigDesc}
                    </Text>
                  </View>
                </View>
                <ChevronRight
                  color={colors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-3.5"
                onPress={() => safeNavigate('AIProviders')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Key color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsAiProviders}
                  </Text>
                  <Text
                    className="text-[12px] font-medium mt-0.5"
                    style={{ color: colors.secondaryText }}
                  >
                    {t.settingsAiProvidersDesc}
                  </Text>
                </View>
                <ChevronRight
                  color={colors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-3.5"
                onPress={() => safeNavigate('ModelPicker')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Brain color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsDefaultModel}
                  </Text>
                  <Text
                    className="text-[12px] font-medium mt-0.5"
                    style={{ color: colors.secondaryText }}
                  >
                    {defaultModel || t.settingsNotConfigured}
                  </Text>
                </View>
                <ChevronRight
                  color={colors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>

        <SettingsSection delay={108} title={t.settingsGroupAdvanced}>
          <View className="mb-4 overflow-hidden rounded-xl bg-foreground/[0.03]">
            {advancedWebEntries.map((entry, index) => {
              const Icon = entry.icon;

              return (
                <TouchableOpacity
                  activeOpacity={0.6}
                  className="flex-row items-center px-5 py-3.5"
                  key={entry.path}
                  onPress={() => void handleOpenWebPath(entry.path)}
                >
                  <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                    <Icon color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                  </View>
                  <View
                    className="flex-1"
                    style={
                      index === advancedWebEntries.length - 1
                        ? undefined
                        : { borderBottomColor: colors.borderSubtle, borderBottomWidth: 1 }
                    }
                  >
                    <Text className="text-foreground text-[15px] font-medium tracking-tight">
                      {entry.label}
                    </Text>
                    <Text
                      className="text-[12px] font-medium mt-0.5 mb-3.5"
                      style={{ color: colors.secondaryText }}
                    >
                      {entry.description}
                    </Text>
                  </View>
                  <ChevronRight
                    color={colors.primary}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </SettingsSection>

        {/* Internationalization — Language */}
        <SettingsSection delay={112} title={t.settingsGroupI18n}>
          <View className="mb-4">
            <TouchableOpacity
              activeOpacity={0.6}
              className="flex-row items-center rounded-xl px-5 py-3.5 bg-foreground/[0.03]"
              onPress={() => {
                haptics.light();
                setLanguageSheetVisible(true);
              }}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                <Globe color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.settingsLanguage}
                </Text>
                <Text
                  className="text-[12px] font-medium mt-0.5"
                  style={{ color: colors.secondaryText }}
                >
                  {LOCALE_DISPLAY_NAMES[locale as keyof typeof LOCALE_DISPLAY_NAMES] ??
                    locale ??
                    'en-US'}
                </Text>
              </View>
              <ChevronRight
                color={colors.primary}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </TouchableOpacity>
          </View>
        </SettingsSection>

        {/* Appearance — Theme, Color */}
        <SettingsSection delay={115} title={t.settingsGroupAppearance}>
          <View className="mb-4">
            <View className="rounded-xl bg-foreground/[0.03] overflow-hidden px-5 py-4">
              <View className="flex-row gap-2 mb-3">
                {THEME_OPTIONS.map((opt) => {
                  const active = themePreference === opt.value;
                  const Icon = opt.icon;
                  return (
                    <Pressable
                      className="flex-1 flex-row items-center justify-center gap-1.5 rounded-lg py-2.5"
                      key={opt.value}
                      style={{
                        backgroundColor: active ? colors.primarySubtle : colors.fillTertiary,
                      }}
                      onPress={() => {
                        haptics.selection();
                        setThemePreference(opt.value);
                      }}
                    >
                      {active && (
                        <Check
                          color={colors.primary}
                          size={12}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      )}
                      <Icon
                        color={active ? colors.primary : colors.muted}
                        size={14}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                      <Text
                        className="text-[12px] font-medium"
                        style={{ color: active ? colors.primary : colors.secondaryText }}
                      >
                        {getThemeLabel(opt.value, t)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View className="flex-row flex-wrap gap-2">
                {COLOR_SCHEME_OPTIONS.map((opt) => {
                  const active = colorScheme === opt.value;
                  return (
                    <Pressable
                      className="flex-row items-center gap-1.5 rounded-lg py-2 px-3"
                      key={opt.value}
                      style={{
                        backgroundColor: active ? colors.primarySubtle : colors.fillTertiary,
                      }}
                      onPress={() => {
                        haptics.selection();
                        setColorScheme(opt.value);
                      }}
                    >
                      <View
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: opt.color }}
                      />
                      <Text
                        className="text-[12px] font-medium"
                        style={{ color: active ? colors.primary : colors.secondaryText }}
                      >
                        {getColorSchemeLabel(opt.value, t)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </SettingsSection>

        {/* Data & Voice */}
        <SettingsSection delay={150} title={t.settingsGroupData}>
          <View className="mb-4">
            <View className="rounded-xl bg-foreground/[0.03] overflow-hidden">
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-3.5"
                onPress={() => safeNavigate('DataManagement')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Database
                    color={colors.primary}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsStorageManagement}
                  </Text>
                  <Text
                    className="text-[12px] font-medium mt-0.5"
                    style={{ color: colors.secondaryText }}
                  >
                    {t.settingsStorageManagementDesc}
                  </Text>
                </View>
                <ChevronRight
                  color={colors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityHint={t.settingsComingSoonHint}
                accessibilityLabel={t.settingsComingSoonSection}
                accessibilityRole="button"
                accessibilityState={{ expanded: dataComingSoonExpanded }}
                activeOpacity={0.65}
                className="flex-row items-center px-5 py-3"
                style={{ borderTopColor: colors.borderSubtle, borderTopWidth: 1 }}
                onPress={() => {
                  haptics.selection();
                  setDataComingSoonExpanded((v) => !v);
                }}
              >
                <View className="flex-1 pr-3">
                  <Text className="text-foreground text-[14px] font-semibold tracking-tight">
                    {t.settingsComingSoonSection}
                  </Text>
                  <Text
                    className="text-[12px] font-medium mt-0.5"
                    style={{ color: colors.tertiaryText }}
                  >
                    {t.settingsComingSoonHint}
                  </Text>
                </View>
                <ChevronDown
                  color={colors.secondaryText}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{
                    transform: [{ rotate: dataComingSoonExpanded ? '180deg' : '0deg' }],
                  }}
                />
              </TouchableOpacity>
              {dataComingSoonExpanded ? (
                <>
                  <View className="flex-row items-center px-5 py-3.5 opacity-60">
                    <View className="w-8 h-8 rounded-full items-center justify-center mr-4 bg-foreground/[0.04]">
                      <Cloud color={colors.muted} size={16} strokeWidth={tokens.icon.strokeWidth} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground text-[15px] font-medium tracking-tight">
                        {t.settingsSyncBackup}
                      </Text>
                      <Text
                        className="text-[12px] font-medium mt-0.5"
                        style={{ color: colors.secondaryText }}
                      >
                        {t.dataManageComingSoon}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center px-5 py-3.5 opacity-60">
                    <View className="w-8 h-8 rounded-full items-center justify-center mr-4 bg-foreground/[0.04]">
                      <Mic color={colors.muted} size={16} strokeWidth={tokens.icon.strokeWidth} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground text-[15px] font-medium tracking-tight">
                        {t.settingsSpeechRecognition}
                      </Text>
                      <Text
                        className="text-[12px] font-medium mt-0.5"
                        style={{ color: colors.secondaryText }}
                      >
                        {t.dataManageComingSoon}
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center px-5 py-3.5 opacity-60">
                    <View className="w-8 h-8 rounded-full items-center justify-center mr-4 bg-foreground/[0.04]">
                      <Volume2
                        color={colors.muted}
                        size={16}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground text-[15px] font-medium tracking-tight">
                        {t.settingsTts}
                      </Text>
                      <Text
                        className="text-[12px] font-medium mt-0.5"
                        style={{ color: colors.secondaryText }}
                      >
                        {t.dataManageComingSoon}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        </SettingsSection>

        <SettingsSection delay={165} title={t.logsTitle}>
          <View className="mb-4">
            <View className="rounded-xl bg-foreground/[0.03] overflow-hidden">
              <View className="flex-row items-center px-5 py-3.5">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4 bg-foreground/[0.04]">
                  <Bug color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.logsCapture}
                  </Text>
                  <Text
                    className="text-[12px] font-medium mt-0.5"
                    style={{ color: colors.secondaryText }}
                  >
                    {t.logsCaptureDesc}
                  </Text>
                </View>
                <Switch
                  accessibilityHint={t.logsCaptureDesc}
                  accessibilityLabel={t.logsCapture}
                  value={loggingEnabled}
                  trackColor={{
                    false: colors.switchTrackOffAlt,
                    true: `${colors.switchTrackOn}66`,
                  }}
                  onValueChange={(value) => {
                    haptics.light();
                    void handleToggleLogging(value);
                  }}
                />
              </View>
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-3.5"
                onPress={() => safeNavigate('AppLogs')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4 bg-foreground/[0.04]">
                  <FileText
                    color={colors.primary}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.logsView}
                  </Text>
                  <Text
                    className="text-[12px] font-medium mt-0.5"
                    style={{ color: colors.secondaryText }}
                  >
                    {t.logsViewDesc}
                  </Text>
                </View>
                <ChevronRight
                  color={colors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
            </View>
          </View>
        </SettingsSection>

        {/* Account */}
        <SettingsSection delay={180} title={t.settingsGroupAccount}>
          <View className="mt-2 mb-4">
            <PressableScale
              className="rounded-xl py-4 items-center bg-foreground/[0.03]"
              onPress={handleSignOut}
            >
              <View className="flex-row items-center gap-2">
                <LogOut color={colors.danger} size={16} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="font-medium text-[14.5px]" style={{ color: colors.danger }}>
                  {t.meSignOut}
                </Text>
              </View>
            </PressableScale>
          </View>
        </SettingsSection>

        {/* Version */}
        <Text
          className="text-center text-[11px] font-medium mt-2"
          style={{ color: colors.tertiaryText }}
        >
          {APP_NAME} v{APP_VERSION}
        </Text>
      </ScrollView>

      <LanguageSheet
        visible={languageSheetVisible}
        onClose={() => setLanguageSheetVisible(false)}
      />
    </View>
  );
}
