/**
 * AgentDetailScreen — Detailed view of a market agent.
 */
import { ArrowLeft, Bot } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useAgentStore } from '../store/agent';
import { useDiscoverStore } from '../store/discover';
import { useSessionStore } from '../store/session';
import { tokens } from '../theme/tokens';

export default function AgentDetailScreen({ route, navigation }: any) {
  const identifier = route.params?.identifier;
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  const agentDetail = useDiscoverStore((s) => s.agentDetail);
  const fetchAgentDetail = useDiscoverStore((s) => s.fetchAgentDetail);
  const createSession = useSessionStore((s) => s.createSession);
  const upsertAgent = useAgentStore((s) => s.upsertAgent);
  const attachSession = useAgentStore((s) => s.attachSession);

  useEffect(() => {
    if (identifier) fetchAgentDetail(identifier);
  }, [identifier, fetchAgentDetail]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await fetchAgentDetail(identifier);
    setRefreshing(false);
  }, [fetchAgentDetail, identifier]);

  const handleUseAgent = async () => {
    haptics.success();
    const agentConfig = agentDetail?.config || {};
    const linkedAgentId = `market:${identifier || agentDetail?.id || Date.now()}`;
    await upsertAgent({
      avatar: agentDetail?.meta.avatar,
      createdAt: agentDetail?.createdAt || new Date().toISOString(),
      id: linkedAgentId,
      model: agentConfig.model,
      params: agentConfig.params,
      plugins: agentConfig.plugins || [],
      provider: agentConfig.provider,
      sessionIds: [],
      systemRole: agentConfig.systemRole,
      title: agentDetail?.meta.title || t.chatListNewConversation,
      updatedAt: new Date().toISOString(),
    });
    const newId = await createSession({
      agentId: linkedAgentId,
      title: agentDetail?.meta.title || t.chatListNewConversation,
      description: agentDetail?.meta.description,
      avatar: agentDetail?.meta.avatar,
      systemPrompt: agentConfig.systemRole,
      model: agentConfig.model,
      provider: agentConfig.provider,
      plugins: agentConfig.plugins,
    });
    await attachSession(linkedAgentId, newId);
    navigation.navigate('ChatDetail', { sessionId: newId });
  };

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(300)}>
        <View className="flex-row items-center px-4 py-2.5">
          <PressableScale
            className="w-9 h-9 items-center justify-center rounded-full"
            onPress={() => {
              haptics.light();
              navigation.goBack();
            }}
          >
            <ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />
          </PressableScale>
          <Text className="flex-1 text-[17px] font-semibold text-foreground text-center mr-9">
            {t.discoverAgentDetail}
          </Text>
        </View>
      </Animated.View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            colors={['#007aff']}
            refreshing={refreshing}
            tintColor="#007aff"
            onRefresh={onRefresh}
          />
        }
      >
        {agentDetail ? (
          <>
            {/* Hero */}
            <Animated.View entering={FadeInDown.delay(50).duration(300)}>
              <View className="items-center px-6 pt-4 pb-6">
                <View className="w-20 h-20 rounded-3xl bg-primary/10 items-center justify-center mb-4">
                  <Text className="text-3xl">{agentDetail.meta.avatar || '🤖'}</Text>
                </View>
                <Text className="text-foreground text-xl font-bold tracking-tight text-center">
                  {agentDetail.meta.title}
                </Text>
                <Text className="text-secondary/60 text-[13px] font-medium mt-1">
                  by {agentDetail.author}
                </Text>
                {agentDetail.meta.tags && agentDetail.meta.tags.length > 0 && (
                  <View className="flex-row flex-wrap justify-center mt-3 gap-1.5">
                    {agentDetail.meta.tags.map((tag) => (
                      <View className="bg-primary/10 rounded-lg px-3 py-1" key={tag}>
                        <Text className="text-primary text-[11px] font-medium">{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </Animated.View>

            {/* Description */}
            <Animated.View entering={FadeInDown.delay(100).duration(300)}>
              <View className="px-6 mb-6">
                <Text className="text-foreground/80 text-[15px] leading-6">
                  {agentDetail.meta.description}
                </Text>
              </View>
            </Animated.View>

            {/* Use Agent Button */}
            <Animated.View entering={FadeInDown.delay(150).duration(300)}>
              <View className="px-6">
                <PressableScale
                  className="bg-primary rounded-2xl py-4 items-center"
                  onPress={handleUseAgent}
                >
                  <Text className="text-white text-[16px] font-semibold">{t.discoverUseAgent}</Text>
                </PressableScale>
              </View>
            </Animated.View>
          </>
        ) : (
          <View className="items-center pt-20">
            <Bot color="#ccc" size={48} strokeWidth={1} />
            <Text className="text-secondary/50 mt-4">{t.loading}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
