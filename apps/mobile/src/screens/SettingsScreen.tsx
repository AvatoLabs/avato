/**
 * SettingsScreen — "More Settings" page with remaining config items.
 *
 * Items moved to Workspace tab: Server Config, AI Providers, Default Model, Language
 * Removed: Theme (deleted)
 */
import {
  ArrowLeft,
  BrainCircuit,
  Check,
  Cloud,
  Database,
  Mic,
  Monitor,
  Moon,
  Sun,
  Volume2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SettingsRow, SettingsSection } from '../components/ui/SettingsLayout';
import { useToast } from '../components/ui/Toast';
import { userApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import type { ThemePreference } from '../store/theme';
import { useThemeStore } from '../store/theme';
import {
  DEFAULT_USER_MEMORY_SETTINGS,
  getUserMemorySettings,
  setCachedUserMemorySettings,
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
];

const getColorSchemeLabel = (
  value: ColorSchemeId,
  t: { themeColorBlue: string; themeColorViolet: string; themeColorGreen: string },
) => {
  if (value === 'blue') return t.themeColorBlue;
  if (value === 'violet') return t.themeColorViolet;
  return t.themeColorGreen;
};

const getThemeLabel = (
  value: ThemePreference,
  t: { themeLight: string; themeDark: string; themeSystem: string },
) => {
  if (value === 'light') return t.themeLight;
  if (value === 'dark') return t.themeDark;
  return t.themeSystem;
};

export default function SettingsScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const themePreference = useThemeStore((s) => s.preference);
  const setThemePreference = useThemeStore((s) => s.setPreference);
  const colorScheme = useThemeStore((s) => s.colorScheme);
  const setColorScheme = useThemeStore((s) => s.setColorScheme);
  const themeColors = useThemeColors();
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

  const safeNavigate = (name: string, params?: object) => {
    try {
      haptics.light();
      navigation?.navigate?.(name, params);
    } catch {
      /* ignore */
    }
  };

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

      const previousEnabled = memoryEnabled;
      const previousEffort = memoryEffort;

      setMemoryEnabled(nextEnabled);
      setMemoryEffort(nextEffort);
      setMemorySaving(true);

      try {
        await userApi.updateSettings({
          memory: {
            effort: nextEffort,
            enabled: nextEnabled,
          },
        });

        setCachedUserMemorySettings({
          effort: nextEffort,
          enabled: nextEnabled,
        });
      } catch {
        setMemoryEnabled(previousEnabled);
        setMemoryEffort(previousEffort);
        toast.show('error', t.errorSaveFailed);
      } finally {
        setMemorySaving(false);
      }
    },
    [memoryEffort, memoryEnabled, memorySaving, t.errorSaveFailed, toast],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.meMoreSettings ?? 'More Settings'}
        leftElement={
          <ArrowLeft color={themeColors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => {
          haptics.light();
          navigation?.goBack?.();
        }}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40, paddingTop: 20 }}>
        <SettingsSection delay={30} title={t.themeTitle}>
          <View className="flex-row gap-2">
            {THEME_OPTIONS.map((option) => {
              const active = themePreference === option.value;
              const Icon = option.icon;
              return (
                <Pressable
                  key={option.value}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3 py-3 ${
                    active ? 'bg-primary/10' : 'bg-foreground/[0.04]'
                  }`}
                  onPress={() => {
                    haptics.selection();
                    setThemePreference(option.value);
                  }}
                >
                  {active ? (
                    <Check
                      color={themeColors.primary}
                      size={16}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  ) : null}
                  <Icon
                    color={active ? themeColors.primary : themeColors.muted}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text
                    className={`text-[14px] font-medium ${active ? 'text-primary' : 'text-secondary/70'}`}
                  >
                    {getThemeLabel(option.value, t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SettingsSection>

        <SettingsSection delay={40} title={t.themeColorScheme}>
          <View className="flex-row gap-2">
            {COLOR_SCHEME_OPTIONS.map((option) => {
              const active = colorScheme === option.value;
              return (
                <Pressable
                  key={option.value}
                  className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl px-3 py-3 ${
                    active ? 'bg-primary/10' : 'bg-foreground/[0.04]'
                  }`}
                  onPress={() => {
                    haptics.selection();
                    setColorScheme(option.value);
                  }}
                >
                  {active ? (
                    <Check
                      color={themeColors.primary}
                      size={16}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  ) : null}
                  <View
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: option.color }}
                  />
                  <Text
                    className={`text-[14px] font-medium ${active ? 'text-primary' : 'text-secondary/70'}`}
                  >
                    {getColorSchemeLabel(option.value, t)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SettingsSection>

        <SettingsSection delay={50} title={t.memoryTitle}>
          <View className="mb-2 rounded-2xl bg-foreground/[0.02] px-5 py-4">
            <View className="flex-row items-center">
              <View className="mr-4 h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <BrainCircuit
                  color={themeColors.primary}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </View>
              <View className="flex-1 pr-4">
                <Text className="text-[15.5px] font-medium tracking-tight text-foreground">
                  {memoryEnabled ? t.memoryToolOnTitle : t.memoryToolOffTitle}
                </Text>
                <Text className="mt-0.5 text-[12.5px] font-medium text-secondary/70">
                  {memoryEnabled ? t.memoryToolOnDesc : t.memoryToolOffDesc}
                </Text>
              </View>
              {memoryLoading ? (
                <ActivityIndicator color={themeColors.primary} />
              ) : (
                <Switch
                  disabled={memorySaving}
                  value={memoryEnabled}
                  trackColor={{
                    false: themeColors.switchTrackOffAlt,
                    true: `${themeColors.switchTrackOn}66`,
                  }}
                  onValueChange={(value) => {
                    haptics.light();
                    void updateMemorySettings(value, memoryEffort);
                  }}
                />
              )}
            </View>
          </View>

          <View className="rounded-2xl bg-foreground/[0.02] px-5 py-4">
            <View className="flex-row items-start">
              <View className="mr-4 mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                <BrainCircuit
                  color={themeColors.primary}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </View>
              <View className="flex-1">
                <View className="flex-row items-center justify-between">
                  <Text className="text-[15.5px] font-medium tracking-tight text-foreground">
                    {t.memoryToolEffortTitle}
                  </Text>
                  {memorySaving && !memoryLoading ? (
                    <ActivityIndicator color={themeColors.primary} size="small" />
                  ) : null}
                </View>
                <Text className="mt-0.5 text-[12.5px] font-medium text-secondary/70">
                  {t.memoryToolEffortDesc}
                </Text>

                <View className="mt-3 flex-row gap-2">
                  {memoryEffortOptions.map((option) => {
                    const active = memoryEffort === option.value;

                    return (
                      <Pressable
                        disabled={memoryLoading || memorySaving}
                        key={option.value}
                        className={`flex-1 flex-row items-center justify-center rounded-xl px-3 py-2.5 ${
                          active ? 'bg-primary/10' : 'bg-foreground/[0.04]'
                        }`}
                        onPress={() => {
                          if (active) return;

                          haptics.selection();
                          void updateMemorySettings(memoryEnabled, option.value);
                        }}
                      >
                        {active ? (
                          <Check
                            color={themeColors.primary}
                            size={14}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                        ) : null}
                        <Text
                          className={`text-[14px] font-medium ${
                            active ? 'ml-1.5 text-primary' : 'text-secondary/70'
                          }`}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </View>
        </SettingsSection>

        <SettingsSection delay={100} title={t.settingsDataStorage}>
          <SettingsRow
            icon={Cloud}
            iconColor={themeColors.primary}
            label={t.settingsSyncBackup}
            subtitle={t.dataManageComingSoon}
          />
          <SettingsRow
            icon={Database}
            iconColor={themeColors.primary}
            label={t.settingsStorageManagement}
            subtitle={t.settingsStorageManagementDesc}
            onPress={() => safeNavigate('DataManagement')}
          />
        </SettingsSection>

        <SettingsSection delay={150} title={t.settingsVoice}>
          <SettingsRow
            icon={Mic}
            iconColor={themeColors.primary}
            label={t.settingsSpeechRecognition}
            subtitle={t.dataManageComingSoon}
          />
          <SettingsRow
            icon={Volume2}
            iconColor={themeColors.primary}
            label={t.settingsTts}
            subtitle={t.dataManageComingSoon}
          />
        </SettingsSection>
      </ScrollView>
    </View>
  );
}
