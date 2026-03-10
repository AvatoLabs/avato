/**
 * ChatListScreen → AI Command Surface
 *
 * Never empty. Shows HeroComposer, QuickActions, Recent chats, and Suggested Assistants.
 */
import { Image } from 'expo-image';
import {
  Code2,
  LineChart,
  MessageSquarePlus,
  Pen,
  Pin,
  Wand2,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Image as RNImage,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useShallow } from 'zustand/shallow';

import { HeroComposer } from '../components/ui/HeroComposer';
import { QuickActionRow } from '../components/ui/QuickActionRow';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionBlock } from '../components/ui/SectionBlock';
import { useI18n } from '../lib/i18n';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export default function ChatListScreen({ navigation }: any) {
  const { t } = useI18n();

  const { sessions, initialized } = useSessionStore(
    useShallow((s) => ({
      sessions: s.sessions,
      initialized: s.initialized,
    })),
  );
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const createSession = useSessionStore((s) => s.createSession);

  const [heroText, setHeroText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!initialized) fetchSessions();
  }, [initialized, fetchSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  }, [fetchSessions]);

  const handleCreateChat = async () => {
    const newId = await createSession();
    navigation.navigate('ChatDetail', { sessionId: newId });
  };

  const handleHeroSubmit = async () => {
    if (!heroText.trim()) return;
    const newId = await createSession();
    // TODO: send heroText as first message
    navigation.navigate('ChatDetail', { sessionId: newId });
    setHeroText('');
  };

  const handleQuickAction = async (_key: string) => {
    const newId = await createSession();
    navigation.navigate('ChatDetail', { sessionId: newId });
  };

  const displaySessions = sessions.slice(0, 5);

  const quickActions = [
    { key: 'write', label: t.homeQuickWrite, icon: Pen },
    { key: 'code', label: t.homeQuickCode, icon: Code2 },
    { key: 'analyze', label: t.homeQuickAnalyze, icon: LineChart },
    { key: 'create', label: t.homeQuickCreate, icon: Wand2 },
  ];

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.chatListTitle}
        leftElement={
          <RNImage
            className="w-7 h-7 rounded-full opacity-80"
            source={require('../../assets/icon.png')}
          />
        }
        rightElement={
          <MessageSquarePlus color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressRight={handleCreateChat}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 30 }}
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
        {/* Hero Composer */}
        <Animated.View entering={FadeInDown.delay(50).duration(350)}>
          <View className="pt-3">
            <HeroComposer
              placeholder={t.homeHeroPlaceholder}
              value={heroText}
              onChangeText={setHeroText}
              onSubmit={handleHeroSubmit}
            />
          </View>
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
          <QuickActionRow
            actions={quickActions}
            onPress={handleQuickAction}
          />
        </Animated.View>

        {/* Recent Conversations */}
        <Animated.View entering={FadeInDown.delay(150).duration(350)}>
          <SectionBlock
            action={sessions.length > 0 ? t.homeSeeAll : undefined}
            title={t.homeRecents}
          >
            {displaySessions.map((item: any) => (
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-row items-center px-5 py-3 active:bg-foreground/5"
                key={item.id}
                onPress={() => {
                  navigation.navigate('ChatDetail', { sessionId: item.id });
                }}
              >
                <View className="w-10 h-10 rounded-full items-center justify-center mr-3.5 bg-foreground/5 dark:bg-white/5">
                  {item.avatar ? (
                    <Image
                      className="w-10 h-10 rounded-full opacity-90"
                      source={{ uri: item.avatar }}
                    />
                  ) : (
                    <RNImage
                      className="w-6 h-6 rounded-sm opacity-70"
                      source={require('../../assets/icon.png')}
                    />
                  )}
                </View>
                <View className="flex-1 mr-3">
                  <View className="flex-row items-center mb-0.5">
                    {item.pinned && (
                      <Pin color="#007aff" size={11} strokeWidth={tokens.icon.strokeWidth} style={{ marginRight: 4 }} />
                    )}
                    <Text className="text-foreground text-[15px] font-medium tracking-tight" numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>
                  <Text className="text-secondary/60 text-[13px] font-medium" numberOfLines={1}>
                    {item.description}
                  </Text>
                </View>
                <Text className="text-secondary/40 text-[11.5px] font-medium">
                  {formatTimeAgo(item.updatedAt)}
                </Text>
              </TouchableOpacity>
            ))}
          </SectionBlock>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
