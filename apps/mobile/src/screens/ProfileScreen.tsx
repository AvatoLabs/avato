/**
 * ProfileScreen → Workspace Control Center
 *
 * Layout:
 *  - WorkspaceOverviewCard: Identity → ProfileEdit, Model → ModelPicker, Providers → AIProviders
 *  - Usage Stats: messages, sessions, streak
 *  - Quick Settings: Server Config, AI Providers, Default Model, Language
 *  - More Settings: entry to remaining config
 *  - Sign Out
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import {
  BarChart3,
  Brain,
  BrainCircuit,
  ChevronRight,
  Globe,
  Key,
  LogOut,
  Server,
  Settings,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { WorkspaceOverviewCard } from '../components/ui/WorkspaceOverviewCard';
import { aiProviderApi, statsApi } from '../lib/api';
import { clearTransientAppState } from '../lib/appState';
import { signOutFromBrowser } from '../lib/auth';
import { haptics } from '../lib/haptics';
import { LOCALE_DISPLAY_NAMES, useI18n } from '../lib/i18n';
import { getApiUrl } from '../lib/server';
import { useConnectionStore } from '../store/connection';
import { useSessionStore } from '../store/session';
import { useUserStore } from '../store/user';
import { tokens } from '../theme/tokens';

const APP_NAME = Constants.expoConfig?.name ?? 'LobeHub';
const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

export default function ProfileScreen({ navigation }: any) {
  const { t, locale } = useI18n();
  const sessionCount = useSessionStore((s) => s.sessions.length);
  const isConnected = useConnectionStore((s) => s.isConnected);
  const checkConnection = useConnectionStore((s) => s.checkConnection);

  const userAvatar = useUserStore((s) => s.avatar);
  const userFullName = useUserStore((s) => s.fullName);
  const userUsername = useUserStore((s) => s.username);
  const fetchUser = useUserStore((s) => s.fetchUser);
  const isUserLoaded = useUserStore((s) => s.isLoaded);
  const userName = userFullName || userUsername;

  const [messageCount, setMessageCount] = useState(0);
  const [topicCount, setTopicCount] = useState(0);
  const [providerCount, setProviderCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [defaultModel, setDefaultModel] = useState<string>('');

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
    AsyncStorage.getItem('minkhub_default_model').then((v) => {
      if (v) setDefaultModel(v);
    });
  }, [loadStats, isUserLoaded, fetchUser]);

  // Re-check server connection every time the screen gains focus
  useFocusEffect(
    useCallback(() => {
      checkConnection();
    }, [checkConnection]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await Promise.all([loadStats(), checkConnection(), fetchUser()]);
    setRefreshing(false);
  }, [loadStats, checkConnection, fetchUser]);

  const handleSignOut = () => {
    Alert.alert(t.meSignOutConfirm, t.meSignOutDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.meSignOut,
        style: 'destructive',
        onPress: async () => {
          const baseUrl = await getApiUrl();
          await signOutFromBrowser(baseUrl);
          await clearTransientAppState();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={t.settingsTitle} />

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
              defaultModel={defaultModel || t.settingsNotConfigured}
              isConnected={isConnected}
              providerCount={providerCount}
              userAvatar={userAvatar}
              userName={userName || t.meUser}
              onPress={() => navigation.navigate('ProfileEdit')}
              onPressModel={() => navigation.navigate('ModelPicker')}
              onPressProviders={() => navigation.navigate('AIProviders')}
            />
          </View>
        </Animated.View>

        {/* Usage Stats — tap to view full stats */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)}>
          <PressableScale onPress={() => navigation.navigate('Stats')}>
            <View className="flex-row px-5 gap-3 mb-4">
              <View className="flex-1 py-3.5 items-center">
                <Text className="text-foreground text-[20px] font-bold">{messageCount}</Text>
                <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                  {t.statsMessages}
                </Text>
              </View>
              <View className="flex-1 py-3.5 items-center">
                <Text className="text-foreground text-[20px] font-bold">{sessionCount}</Text>
                <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                  {t.statsSessions}
                </Text>
              </View>
              <View className="flex-1 py-3.5 items-center">
                <Text className="text-foreground text-[20px] font-bold">{topicCount}</Text>
                <Text className="text-secondary/40 text-[10px] font-semibold uppercase tracking-widest mt-1">
                  {t.statsTotalTopics}
                </Text>
              </View>
            </View>
          </PressableScale>
          {/* Stats entry hint */}
          <View className="px-5 mb-4">
            <PressableScale
              className="flex-row items-center rounded-xl px-5 py-3.5 border border-black/5"
              onPress={() => navigation.navigate('Stats')}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                <BarChart3 color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.statsTitle}
                </Text>
                <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                  {t.statsOverview}
                </Text>
              </View>
              <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
            </PressableScale>
          </View>
        </Animated.View>

        {/* Memory */}
        <Animated.View entering={FadeInDown.delay(90).duration(350)}>
          <View className="px-5 mb-4">
            <PressableScale
              className="flex-row items-center rounded-xl px-5 py-3.5 border border-black/5"
              onPress={() => navigation.navigate('Memory')}
            >
              <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                <BrainCircuit color="#8b5cf6" size={16} strokeWidth={tokens.icon.strokeWidth} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-medium tracking-tight">
                  {t.memoryTitle}
                </Text>
                <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                  {t.memoryDesc}
                </Text>
              </View>
              <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
            </PressableScale>
          </View>
        </Animated.View>

        {/* Quick Settings */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
          <View className="px-5 mb-4">
            <View className="rounded-xl border border-black/5 overflow-hidden">
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-4 py-3.5 border-b border-black/5"
                onPress={() => navigation.navigate('ServerConfig')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Server color="#4caf50" size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsServerConfig}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                    {t.settingsServerConfigDesc}
                  </Text>
                </View>
                <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-4 py-3.5 border-b border-black/5"
                onPress={() => navigation.navigate('AIProviders')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Key color="#e83e8c" size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsAiProviders}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                    {t.settingsAiProvidersDesc}
                  </Text>
                </View>
                <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-4 py-3.5 border-b border-black/5"
                onPress={() => navigation.navigate('ModelPicker')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Brain color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsDefaultModel}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                    {defaultModel || t.settingsNotConfigured}
                  </Text>
                </View>
                <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-4 py-3.5"
                onPress={() => navigation.navigate('LanguagePicker')}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center mr-4">
                  <Globe color="#f5a623" size={16} strokeWidth={tokens.icon.strokeWidth} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[15px] font-medium tracking-tight">
                    {t.settingsLanguage}
                  </Text>
                  <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                    {LOCALE_DISPLAY_NAMES[locale] || locale}
                  </Text>
                </View>
                <ChevronRight color="#c0c0c0" size={18} strokeWidth={tokens.icon.strokeWidth} />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>

        {/* More Settings */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)}>
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
                  {t.meMoreSettings}
                </Text>
                <Text className="text-secondary/50 text-[12px] font-medium mt-0.5">
                  {t.meMoreSettingsDesc}
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
          {APP_NAME} v{APP_VERSION}
        </Text>
      </ScrollView>
    </View>
  );
}
