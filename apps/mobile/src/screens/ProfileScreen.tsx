/**
 * ProfileScreen → Workspace Control Center
 *
 * Layering strategy:
 * - Workspace tab: Overview card + Runtime cards + Preferences (quick access)
 * - Settings screen (push): Full config (Server, Providers, Model, Data, Voice, About)
 *
 * No duplication: Workspace shows status & quick toggles. Settings shows full config.
 * Avatar tap → Settings (profile editing is backend-dependent, not yet available).
 */
import { ChevronRight, Globe, LogOut, Moon, Palette, Pencil, Settings } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { SectionBlock } from '../components/ui/SectionBlock';
import { WorkspaceOverviewCard } from '../components/ui/WorkspaceOverviewCard';
import { clearAuth } from '../lib/api';
import { haptics } from '../lib/haptics';
import { LOCALE_DISPLAY_NAMES, useI18n } from '../lib/i18n';
import { getMessageCount, getStreak } from '../lib/streak';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';

interface SettingsRowProps {
  icon: any;
  iconColor?: string;
  label: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showArrow?: boolean;
  subtitle?: string;
}

function SettingsRow({
  icon: IconComp,
  iconColor = '#007aff',
  label,
  onPress,
  rightElement,
  showArrow = true,
  subtitle,
}: SettingsRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      className="flex-row items-center px-4 py-3.5 mb-1 rounded-xl active:bg-foreground/5"
      disabled={!onPress && !rightElement}
      onPress={onPress}
    >
      <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
        <IconComp color={iconColor} size={16} strokeWidth={tokens.icon.strokeWidth} />
      </View>
      <View className="flex-1">
        <Text className="text-foreground text-[15px] font-medium tracking-tight">{label}</Text>
        {subtitle && (
          <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">{subtitle}</Text>
        )}
      </View>
      {rightElement ||
        (showArrow && onPress && (
          <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
        ))}
    </TouchableOpacity>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t, locale } = useI18n();
  const sessionCount = useSessionStore((s) => s.sessions.length);

  const [streak, setStreak] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    const [s, m] = await Promise.all([getStreak(), getMessageCount()]);
    setStreak(s);
    setMessageCount(m);
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await loadStats();
    setRefreshing(false);
  }, [loadStats]);

  const handleSignOut = () => {
    Alert.alert(t.meSignOutConfirm, t.meSignOutDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.meSignOut,
        style: 'destructive',
        onPress: async () => {
          await clearAuth();
          navigation.reset({
            index: 0,
            routes: [{ name: 'ServerConfig', params: { firstLaunch: true } }],
          });
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t.workspaceTitle} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            colors={['#007aff']}
            refreshing={refreshing}
            tintColor={isDark ? '#0a84ff' : '#007aff'}
            onRefresh={onRefresh}
          />
        }
      >
        {/* Workspace Overview — taps into full Settings */}
        <Animated.View entering={FadeInDown.delay(50).duration(350)}>
          <View className="pt-3">
            <WorkspaceOverviewCard
              defaultModel="GPT-4o Mini"
              isConnected={false}
              providerCount={0}
              userName={t.meUser}
              onPress={() => navigation.navigate('Settings')}
            />
          </View>
        </Animated.View>

        {/* Usage Stats */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)}>
          <View className="flex-row px-5 gap-3 mb-4">
            <View className="flex-1 rounded-xl p-4 items-center border border-black/5 dark:border-white/[0.06]">
              <Text className="text-foreground text-[20px] font-bold">{messageCount}</Text>
              <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                {t.statsMessages}
              </Text>
            </View>
            <View className="flex-1 rounded-xl p-4 items-center border border-black/5 dark:border-white/[0.06]">
              <Text className="text-foreground text-[20px] font-bold">{sessionCount}</Text>
              <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                {t.statsSessions}
              </Text>
            </View>
            <View className="flex-1 rounded-xl p-4 items-center border border-black/5 dark:border-white/[0.06]">
              <Text className="text-foreground text-[20px] font-bold">{streak}</Text>
              <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                {t.statsStreak}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Runtime — quick status cards (unique to Workspace, NOT in Settings) */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
          <SectionBlock title={t.workspaceRuntime}>
            <View className="px-3">
              <View className="flex-row gap-3 mb-1">
                <PressableScale
                  className="flex-1 rounded-xl p-4 border border-black/5 dark:border-white/[0.06]"
                  onPress={() => navigation.navigate('ModelPicker')}
                >
                  <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mb-2">
                    {t.workspaceModel}
                  </Text>
                  <Text className="text-foreground text-[14px] font-medium tracking-tight">
                    GPT-4o Mini
                  </Text>
                  <Text className="text-secondary/50 text-[11px] font-medium mt-0.5">OpenAI</Text>
                </PressableScale>
                <PressableScale
                  className="flex-1 rounded-xl p-4 border border-black/5 dark:border-white/[0.06]"
                  onPress={() => navigation.navigate('ServerConfig')}
                >
                  <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mb-2">
                    {t.workspaceEndpoint}
                  </Text>
                  <Text
                    className="text-foreground text-[14px] font-medium tracking-tight"
                    numberOfLines={1}
                  >
                    localhost:3010
                  </Text>
                  <View className="flex-row items-center mt-1">
                    <View className="w-1.5 h-1.5 rounded-full bg-secondary/30 mr-1.5" />
                    <Text className="text-secondary/50 text-[11px] font-medium">
                      {t.workspaceNotConnected}
                    </Text>
                  </View>
                </PressableScale>
              </View>
            </View>
          </SectionBlock>
        </Animated.View>

        {/* Preferences — quick toggles (unique to Workspace) */}
        <Animated.View entering={FadeInDown.delay(150).duration(350)}>
          <SectionBlock title={t.workspacePreferences}>
            <View className="px-3">
              <SettingsRow
                icon={Moon}
                iconColor={isDark ? '#f5a623' : '#6c6c6c'}
                label={t.meDarkMode}
                showArrow={false}
                rightElement={
                  <Switch
                    thumbColor="#fff"
                    trackColor={{ false: isDark ? '#3a3a3c' : '#e0e0e0', true: '#007aff' }}
                    value={isDark}
                    onValueChange={toggleColorScheme}
                  />
                }
              />
              <SettingsRow
                icon={Globe}
                label={t.meLanguage}
                subtitle={LOCALE_DISPLAY_NAMES[locale] || locale}
                onPress={() => navigation.navigate('LanguagePicker')}
              />
              <SettingsRow
                icon={Palette}
                iconColor="#9c27b0"
                label={t.meTheme}
                subtitle={isDark ? t.themeDark : t.themeLight}
                onPress={() => navigation.navigate('ThemePicker')}
              />
            </View>
          </SectionBlock>
        </Animated.View>

        {/* Edit Profile */}
        <Animated.View entering={FadeInDown.delay(200).duration(350)}>
          <View className="px-5 mb-4">
            <PressableScale
              className="flex-row items-center rounded-xl px-5 py-4 mb-3 border border-black/5 dark:border-white/[0.06]"
              onPress={() => navigation.navigate('ProfileEdit')}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                <Pencil color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.profileEdit}
                </Text>
              </View>
              <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
            </PressableScale>
          </View>
        </Animated.View>

        {/* All Settings — single entry point, no duplication */}
        <Animated.View entering={FadeInDown.delay(250).duration(350)}>
          <View className="px-5 mb-4">
            <PressableScale
              className="flex-row items-center rounded-xl px-5 py-4 border border-black/5 dark:border-white/[0.06]"
              onPress={() => navigation.navigate('Settings')}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                <Settings
                  color={isDark ? '#888' : '#666'}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.meAllSettings}
                </Text>
                <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                  {t.meAllSettingsDesc}
                </Text>
              </View>
              <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
            </PressableScale>
          </View>
        </Animated.View>

        {/* Sign Out */}
        <Animated.View entering={FadeInDown.delay(250).duration(350)}>
          <View className="px-5 mt-2 mb-4">
            <PressableScale
              className="rounded-xl py-4 items-center border border-black/5 dark:border-white/[0.06]"
              onPress={handleSignOut}
            >
              <View className="flex-row items-center gap-2">
                <LogOut color="#ff3b30" size={16} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="text-[#ff3b30] font-medium text-[14.5px]">{t.meSignOut}</Text>
              </View>
            </PressableScale>
          </View>
        </Animated.View>

        {/* Version */}
        <Text className="text-center text-secondary/30 text-[11px] font-medium mt-2">
          MinkHub v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
