/**
 * TopicListScreen — Lists topics for a session with search, create, and management.
 * Aligned with Memory/Settings subpage style: ScreenHeader + consistent content padding.
 */
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import EmptyState from '../components/ui/EmptyState';
import ListSkeleton from '../components/ui/ListSkeleton';
import PromptModal from '../components/ui/PromptModal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import TopicItem from '../components/ui/TopicItem';
import { topicApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useChatStore } from '../store/chat';
import { useTopicStore } from '../store/topic';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

export default function TopicListScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId;
  const sessionKey = sessionId ?? '__invalid_session__';
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();

  const topics = useTopicStore((s) => s.topicsBySession[sessionKey] ?? []);
  const activeTopic = useTopicStore((s) => s.activeTopicBySession[sessionKey] ?? null);
  const loading = useTopicStore((s) => s.loadingBySession[sessionKey] ?? false);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);
  const createTopic = useTopicStore((s) => s.createTopic);
  const removeTopic = useTopicStore((s) => s.removeTopic);
  const switchTopic = useTopicStore((s) => s.switchTopic);
  const favoriteTopic = useTopicStore((s) => s.favoriteTopic);
  const updateTopic = useTopicStore((s) => s.updateTopic);
  const fetchMessages = useChatStore((s) => s.fetchMessages);

  const handleSmartRename = useCallback(
    async (topicId: string) => {
      if (!sessionId) return;
      try {
        const newTitle = await topicApi.generateTitle(topicId);
        if (newTitle?.trim()) {
          await updateTopic(topicId, sessionId, newTitle.trim());
          haptics.success();
          toast.show('success', t.topicRenamed);
        } else {
          toast.show('error', t.toastTitleGenerationFailed || 'Failed to generate title');
        }
      } catch {
        toast.show('error', t.toastTitleGenerationFailed || 'Failed to generate title');
      }
    },
    [sessionId, t, toast, updateTopic],
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [createPromptVisible, setCreatePromptVisible] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      toast.show('error', t.errorUnknown);
      navigation.goBack();
      return;
    }

    fetchTopics(sessionId).catch(() => {
      toast.show('error', t.errorNetwork);
    });
  }, [fetchTopics, navigation, sessionId, t.errorNetwork, t.errorUnknown, toast]);

  const onRefresh = useCallback(async () => {
    if (!sessionId) return;
    setRefreshing(true);
    haptics.light();
    try {
      await fetchTopics(sessionId);
    } catch {
      toast.show('error', t.errorNetwork);
    }
    setRefreshing(false);
  }, [fetchTopics, sessionId, t.errorNetwork, toast]);

  const handleCreateTopic = useCallback(() => {
    setCreatePromptVisible(true);
  }, []);

  const handleSwitchTopic = useCallback(
    (topicId: string | null) => {
      if (!sessionId) return;

      try {
        switchTopic(sessionId, topicId);
        void fetchMessages(sessionId, topicId ?? undefined);
        navigation.goBack();
      } catch {
        toast.show('error', t.errorUnknown);
      }
    },
    [fetchMessages, navigation, sessionId, switchTopic, t.errorUnknown, toast],
  );

  const filteredTopics = searchQuery
    ? topics.filter((tp) => (tp.title || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : topics;

  const sortedTopics = [...filteredTopics].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        rightAccessibilityLabel={t.accessibilityAddTopic}
        title={t.topicTitle}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        rightElement={
          <Plus color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressRight={handleCreateTopic}
        onPressLeft={() => {
          haptics.light();
          navigation.goBack();
        }}
      />

      <View className="px-5 pb-3 pt-1">
        <View className="bg-foreground/5 rounded-xl px-4 py-2.5 flex-row items-center">
          <TextInput
            className="flex-1 text-foreground text-[15px]"
            placeholder={t.topicSearch}
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(50).duration(250)}>
        <TouchableOpacity
          activeOpacity={0.6}
          className={`flex-row items-center px-5 py-3.5 rounded-xl mx-5 mb-2 ${
            activeTopic === null ? 'bg-primary/10' : 'active:bg-foreground/5'
          }`}
          onPress={() => handleSwitchTopic(null)}
        >
          <MessageCircle
            color={activeTopic === null ? colors.primary : colors.secondaryText}
            size={18}
            strokeWidth={tokens.icon.strokeWidth}
          />
          <Text
            className={`ml-3 text-[15px] font-medium ${
              activeTopic === null ? 'text-primary' : 'text-foreground'
            }`}
          >
            {t.topicAllMessages}
          </Text>
        </TouchableOpacity>
      </Animated.View>

      <FlatList
        contentContainerStyle={{ paddingBottom: 30 }}
        data={sortedTopics}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          loading ? (
            <ListSkeleton />
          ) : (
            <EmptyState description={t.topicEmptyDesc} icon="📋" title={t.topicEmpty} />
          )
        }
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={onRefresh}
          />
        }
        renderItem={({ item }) => (
          <TopicItem
            isActive={activeTopic === item.id}
            topic={item}
            onDelete={() => removeTopic(item.id, sessionId)}
            onFavorite={() => favoriteTopic(item.id)}
            onPress={() => handleSwitchTopic(item.id)}
            onRename={(newTitle) => updateTopic(item.id, sessionId, newTitle)}
            onSmartRename={() => handleSmartRename(item.id)}
          />
        )}
      />

      <PromptModal
        placeholder={t.topicCreatePlaceholder}
        submitLabel={t.save}
        title={t.topicCreate}
        visible={createPromptVisible}
        onCancel={() => setCreatePromptVisible(false)}
        onSubmit={async (title) => {
          setCreatePromptVisible(false);
          haptics.success();
          if (!sessionId) return;

          try {
            await createTopic(sessionId, title);
          } catch {
            toast.show('error', t.errorNetwork);
          }
        }}
      />
    </View>
  );
}
