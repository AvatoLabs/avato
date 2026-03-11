/**
 * ProfileScreen → Workspace Control Center
 *
 * Layout:
 *  - WorkspaceOverviewCard: Identity → ProfileEdit, Model → ModelPicker, Providers → AIProviders
 *  - Usage Stats: messages, sessions, streak
 *  - All Settings: single entry to full config
 *  - Sign Out
 *
 * No duplication with SettingsScreen — all configuration (Language, Theme, Server,
 * Data, Voice, About) lives exclusively in Settings.
 */
import { useFocusEffect } from '@react-navigation/native';
import { ChevronRight, LogOut, Settings } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { WorkspaceOverviewCard } from '../components/ui/WorkspaceOverviewCard';
import { clearAuth, userApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { getMessageCount, getStreak } from '../lib/streak';
import { useConnectionStore } from '../store/connection';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';

export default function ProfileScreen({ navigation }: any) {
  const { t } = useI18n();
  const sessionCount = useSessionStore((s) => s.sessions.length);
  const isConnected = useConnectionStore((s) => s.isConnected);
  const checkConnection = useConnectionStore((s) => s.checkConnection);

  const [streak, setStreak] = useState(0);
  const [messageCount, setMessageCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const [s, m] = await Promise.all([getStreak(), getMessageCount()]);
    setStreak(s);
    setMessageCount(m);
  }, []);

  const loadUser = useCallback(async () => {
    try {
      const u = await userApi.getUser();
      if (u?.avatar) setUserAvatar(u.avatar);
      if (u?.fullName || u?.username) setUserName(u.fullName || u.username || null);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadUser();
  }, [loadStats, loadUser]);

  // Re-check server connection every time the screen gains focus
  useFocusEffect(
    useCallback(() => {
      checkConnection();
    }, [checkConnection]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await Promise.all([loadStats(), checkConnection(), loadUser()]);
    setRefreshing(false);
  }, [loadStats, checkConnection, loadUser]);

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
            tintColor="#007aff"
            onRefresh={onRefresh}
          />
        }
      >
        {/* Workspace Overview — taps into profile / model / providers */}
        <Animated.View entering={FadeInDown.delay(50).duration(350)}>
          <View className="pt-3">
            <WorkspaceOverviewCard
              defaultModel="GPT-4o Mini"
              isConnected={isConnected}
              providerCount={0}
              userAvatar={userAvatar}
              userName={userName || t.meUser}
              onPress={() => navigation.navigate('ProfileEdit')}
              onPressModel={() => navigation.navigate('ModelPicker')}
              onPressProviders={() => navigation.navigate('AIProviders')}
            />
          </View>
        </Animated.View>

        {/* Usage Stats */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)}>
          <View className="flex-row px-5 gap-3 mb-4">
            <View className="flex-1 rounded-xl p-4 items-center border border-black/5">
              <Text className="text-foreground text-[20px] font-bold">{messageCount}</Text>
              <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                {t.statsMessages}
              </Text>
            </View>
            <View className="flex-1 rounded-xl p-4 items-center border border-black/5">
              <Text className="text-foreground text-[20px] font-bold">{sessionCount}</Text>
              <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                {t.statsSessions}
              </Text>
            </View>
            <View className="flex-1 rounded-xl p-4 items-center border border-black/5">
              <Text className="text-foreground text-[20px] font-bold">{streak}</Text>
              <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                {t.statsStreak}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* All Settings — single entry point */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
          <View className="px-5 mb-4">
            <PressableScale
              className="flex-row items-center rounded-xl px-5 py-4 border border-black/5"
              onPress={() => navigation.navigate('Settings')}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                <Settings color="#666" size={16} strokeWidth={tokens.icon.strokeWidth} />
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
        <Animated.View entering={FadeInDown.delay(150).duration(350)}>
          <View className="px-5 mt-2 mb-4">
            <PressableScale
              className="rounded-xl py-4 items-center border border-black/5"
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
