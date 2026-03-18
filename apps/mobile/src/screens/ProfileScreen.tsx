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
  Check,
  ChevronRight,
  Cloud,
  Database,
  FileText,
  Globe,
  Key,
  LogOut,
  Mic,
  Monitor,
  Moon,
  Server,
  Settings,
  Sun,
  Volume2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SettingsSection } from '../components/ui/SettingsLayout';
import { useToast } from '../components/ui/Toast';
import { WorkspaceOverviewCard } from '../components/ui/WorkspaceOverviewCard';
import { aiProviderApi, statsApi, userApi } from '../lib/api';
import { APP_NAME, APP_VERSION } from '../lib/appInfo';
import { clearTransientAppState } from '../lib/appState';
import { signOutFromBrowser } from '../lib/auth';
import { haptics } from '../lib/haptics';
import { LOCALE_DISPLAY_NAMES, useI18n } from '../lib/i18n';
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
import type { ColorSchemeId } from '../theme/palettes';
import { tokens } from '../theme/tokens';
import type { MobileMemoryEffort } from '../types';

const THEME_OPTIONS: { icon: typeof Sun; value: ThemePreference }[] = [
  { icon: Sun, value: 'light' },
  { icon: Moon, value: 'dark' },
  { icon: Monitor, value: 'system' },
];

const COLOR_SCHEME_OPTIONS: { color: string; value: ColorSchemeId }[] = [
  { color: '#007aff', value: 'blue' },
  { color: '#8b5cf6', value: 'violet' },
  { color: '#10b981', value: 'green' },
  { color: '#475569', value: 'slate' },
];

const getColorSchemeLabel = (
  value: ColorSchemeId,
  t: {
    themeColorBlue: string;
    themeColorGreen: string;
    themeColorSlate: string;
    themeColorViolet: string;
  },
) => {
  if (value === 'blue') return t.themeColorBlue;
  if (value === 'violet') return t.themeColorViolet;
  if (value === 'green') return t.themeColorGreen;
  return t.themeColorSlate;
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
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const setColorScheme = useThemeStore((s) => s.setColorScheme);
  const sessionCount = useSessionStore((s) => s.sessions.length);
  const isConnected = useConnectionStore((s) => s.isConnected);
  const checkConnection = useConnectionStore((s) => s.checkConnection);

  const userAvatar = useUserStore((s) => s.avatar);
  const userEmail = useUserStore((s) => s.email);
  const userFullName = useUserStore((s) => s.fullName);
  const fetchUser = useUserStore((s) => s.fetchUser);
  const isUserLoaded = useUserStore((s) => s.isLoaded);
  const userName = userFullName || userEmail;

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

  const memoryEffortOptions = useMemo<Array<{ label: string; value: MobileMemoryEffort }>>(
    () => [
      { label: t.memoryToolEffortLow, value: 'low' },
      { label: t.memoryToolEffortMedium, value: 'medium' },
      { label: t.memoryToolEffortHigh, value: 'high' },
    ],
    [t.memoryToolEffortHigh, t.memoryToolEffortLow, t.memoryToolEffortMedium],
  );

  const currentAgent = useAgentStore((s) => {
    if (!s.initialized) return null;
    return s.getCurrentAgent();
  });
  const defaultModel = currentAgent?.model ?? '';

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
      if (!useAgentStore.getState().initialized) {
        void useAgentStore.getState().loadAgents();
      }
    }, [checkConnection, fetchUser, loadMemorySettings]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await Promise.all([loadStats(), checkConnection(), fetchUser(), loadMemorySettings()]);
    setRefreshing(false);
  }, [loadStats, checkConnection, fetchUser, loadMemorySettings]);

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
        title={t.settingsTitle ?? 'Settings'}
        titleIcon={
          <Settings color={colors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
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
        <Animated.View entering={FadeInDown.delay(50).duration(350)}>
          <View className="pt-3">
            <WorkspaceOverviewCard
              defaultModel={defaultModel || t.settingsNotConfigured}
              isConnected={isConnected}
              providerCount={providerCount}
              userAvatar={userAvatar}
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
              className="rounded-xl overflow-hidden bg-foreground/[0.03] px-5 pt-4 pb-4"
              onPress={() => navigation?.navigate?.('Stats')}
            >
              <View className="flex-row items-center mb-4">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4 bg-primary/10">
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
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
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
                <View className="flex-1 rounded-xl px-3.5 py-3 bg-foreground/[0.04]">
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
                <View className="flex-1 rounded-xl px-3.5 py-3 bg-foreground/[0.04]">
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
                <View className="flex-1 rounded-xl px-3.5 py-3 bg-foreground/[0.04]">
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
            <PressableScale
              className="flex-row items-center rounded-xl px-5 py-3.5 bg-foreground/[0.03]"
              onPress={() => navigation?.navigate?.('Memory')}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
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
                <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                  {t.memoryDesc}
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
              className="flex-row items-center rounded-xl px-5 py-3.5 bg-foreground/[0.03]"
              onPress={() => navigation?.navigate?.('AgentList')}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                <Bot color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.meAgents}
                </Text>
                <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
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
              className="flex-row items-center rounded-xl px-5 py-3.5 bg-foreground/[0.03]"
              onPress={() => navigation?.navigate?.('Notebook', {})}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                <FileText color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.notebookTitle}
                </Text>
                <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
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
        <SettingsSection delay={105} title={t.settingsGroupConnection}>
          <View className="mb-4">
            <View className="rounded-xl bg-foreground/[0.03] overflow-hidden">
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-3.5"
                onPress={() => navigation?.navigate?.('ServerConfig')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Server color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsServerConfig}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                    {t.settingsServerConfigDesc}
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
                onPress={() => navigation?.navigate?.('AIProviders')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Key color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsAiProviders}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
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
                onPress={() => navigation?.navigate?.('ModelPicker')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Brain color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsDefaultModel}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
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

        {/* Appearance — Language, Theme, Color */}
        <SettingsSection delay={115} title={t.settingsGroupAppearance}>
          <TouchableOpacity
            activeOpacity={0.6}
            className="flex-row items-center rounded-xl px-5 py-3.5 mb-2 bg-foreground/[0.03]"
            onPress={() => navigation?.navigate?.('LanguagePicker')}
          >
            <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
              <Globe color={colors.primary} size={16} strokeWidth={tokens.icon.strokeWidth} />
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-[15px] font-medium tracking-tight">
                {t.settingsLanguage}
              </Text>
              <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                {LOCALE_DISPLAY_NAMES[locale as keyof typeof LOCALE_DISPLAY_NAMES] ??
                  locale ??
                  'en-US'}
              </Text>
            </View>
            <ChevronRight color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>

          <View className="mb-4">
            <View className="rounded-xl bg-foreground/[0.03] overflow-hidden px-5 pt-4 pb-4">
              <Text className="text-secondary/70 text-[12px] font-medium mb-3">{t.themeTitle}</Text>
              <View className="flex-row gap-2 mb-4">
                {THEME_OPTIONS.map((opt) => {
                  const active = themePreference === opt.value;
                  const Icon = opt.icon;
                  return (
                    <Pressable
                      key={opt.value}
                      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3 py-2.5 ${
                        active ? 'bg-primary/10' : 'bg-foreground/[0.04]'
                      }`}
                      onPress={() => {
                        haptics.selection();
                        setThemePreference(opt.value);
                      }}
                    >
                      {active ? (
                        <Check
                          color={colors.primary}
                          size={14}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      ) : null}
                      <Icon
                        color={active ? colors.primary : colors.muted}
                        size={16}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                      <Text
                        className={`text-[13px] font-medium ${active ? 'text-primary' : 'text-secondary/70'}`}
                      >
                        {getThemeLabel(opt.value, t)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text className="text-secondary/70 text-[12px] font-medium mb-3">
                {t.themeColorScheme}
              </Text>
              <View className="flex-row gap-2">
                {COLOR_SCHEME_OPTIONS.map((opt) => {
                  const active = colorScheme === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3 py-2.5 ${
                        active ? 'bg-primary/10' : 'bg-foreground/[0.04]'
                      }`}
                      onPress={() => {
                        haptics.selection();
                        setColorScheme(opt.value);
                      }}
                    >
                      {active ? (
                        <Check
                          color={colors.primary}
                          size={14}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      ) : null}
                      <View
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: opt.color }}
                      />
                      <Text
                        className={`text-[13px] font-medium ${active ? 'text-primary' : 'text-secondary/70'}`}
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

        {/* Memory — inline config */}
        <SettingsSection delay={118} title={t.settingsGroupMemory}>
          <View className="mb-4">
            <View className="rounded-xl bg-foreground/[0.03] overflow-hidden px-5 py-4">
              <View className="flex-row items-center mb-4">
                <View className="mr-4 h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                  <BrainCircuit
                    color={colors.primary}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </View>
                <View className="flex-1 pr-4">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {memoryEnabled ? t.memoryToolOnTitle : t.memoryToolOffTitle}
                  </Text>
                  <Text className="mt-0.5 text-secondary/70 text-[12px] font-medium">
                    {memoryEnabled ? t.memoryToolOnDesc : t.memoryToolOffDesc}
                  </Text>
                </View>
                {memoryLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Switch
                    disabled={memorySaving}
                    value={memoryEnabled}
                    trackColor={{
                      false: colors.switchTrackOffAlt,
                      true: `${colors.switchTrackOn}66`,
                    }}
                    onValueChange={(v) => {
                      haptics.light();
                      void updateMemorySettings(v, memoryEffort);
                    }}
                  />
                )}
              </View>
              <View className="flex-row gap-2">
                {memoryEffortOptions.map((opt) => {
                  const active = memoryEffort === opt.value;
                  return (
                    <Pressable
                      disabled={memoryLoading || memorySaving}
                      key={opt.value}
                      className={`flex-1 flex-row items-center justify-center rounded-xl px-3 py-2.5 ${
                        active ? 'bg-primary/10' : 'bg-foreground/[0.04]'
                      }`}
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
                        className={`text-[13px] font-medium ${active ? 'ml-1.5 text-primary' : 'text-secondary/70'}`}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </SettingsSection>

        {/* Data & Voice */}
        <SettingsSection delay={120} title={t.settingsGroupData}>
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
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                    {t.settingsStorageManagementDesc}
                  </Text>
                </View>
                <ChevronRight
                  color={colors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
              <View className="flex-row items-center px-5 py-3.5 opacity-60">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4 bg-foreground/[0.04]">
                  <Cloud color={colors.muted} size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsSyncBackup}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
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
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                    {t.dataManageComingSoon}
                  </Text>
                </View>
              </View>
              <View className="flex-row items-center px-5 py-3.5 opacity-60">
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4 bg-foreground/[0.04]">
                  <Volume2 color={colors.muted} size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsTts}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                    {t.dataManageComingSoon}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </SettingsSection>

        {/* Account */}
        <SettingsSection delay={150} title={t.settingsGroupAccount}>
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
        <Text className="text-center text-secondary/30 text-[11px] font-medium mt-2">
          {APP_NAME} v{APP_VERSION}
        </Text>
      </ScrollView>
    </View>
  );
}
