/**
 * TopicListScreen — Lists topics for a session with search, create, and management.
 * Aligned with Memory/Settings subpage style: ScreenHeader + consistent content padding.
 */
import { ArrowLeft, Check, MessageCircle, Plus } from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import EmptyState from '../components/ui/EmptyState';
import ListSkeleton from '../components/ui/ListSkeleton';
import PromptModal from '../components/ui/PromptModal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SearchField } from '../components/ui/SearchField';
import { SelectionListItem } from '../components/ui/SelectionList';
import { useToast } from '../components/ui/Toast';
import TopicItem from '../components/ui/TopicItem';
import { resolveTagColor } from '../constants/tags';
import { tagApi } from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { navigateToLogin } from '../lib/navigation';
import { generateBestTitle } from '../lib/titleGeneration';
import type { RootStackScreenProps } from '../navigation/types';
import { useChatStore } from '../store/chat';
import { useSessionStore } from '../store/session';
import { EMPTY_TOPICS, useTopicStore } from '../store/topic';
import { useThemeColors } from '../theme/colors';
import { enteringSection } from '../theme/motion';
import { tokens } from '../theme/tokens';
import type { Topic } from '../types';

const TopicListRow = memo(function TopicListRow({
  topic,
  sessionId,
  activeTopicId,
  isGroupSession,
  removeTopic,
  favoriteTopic,
  handleSwitchTopic,
  updateTopic,
  handleSmartRename,
  setTopicTagTarget,
}: {
  activeTopicId: string | null;
  favoriteTopic: (id: string) => Promise<void>;
  handleSmartRename: (topicId: string) => Promise<void>;
  handleSwitchTopic: (topicId: string | null) => void;
  isGroupSession: boolean;
  removeTopic: (id: string, sessionId: string) => Promise<void>;
  sessionId: string;
  setTopicTagTarget: React.Dispatch<
    React.SetStateAction<{
      currentTagId?: string | null;
      sessionId: string;
      topicId: string;
    } | null>
  >;
  topic: Topic;
  updateTopic: (id: string, sessionId: string, title: string) => Promise<void>;
}) {
  const onDelete = useCallback(
    () => removeTopic(topic.id, sessionId),
    [removeTopic, sessionId, topic.id],
  );
  const onFavorite = useCallback(() => favoriteTopic(topic.id), [favoriteTopic, topic.id]);
  const onPress = useCallback(() => handleSwitchTopic(topic.id), [handleSwitchTopic, topic.id]);
  const onRename = useCallback(
    (newTitle: string) => updateTopic(topic.id, sessionId, newTitle),
    [sessionId, topic.id, updateTopic],
  );
  const onSmartRename = useCallback(
    () => handleSmartRename(topic.id),
    [handleSmartRename, topic.id],
  );
  const onMoveToTag = useMemo(() => {
    if (isGroupSession || !sessionId) return undefined;
    return () =>
      setTopicTagTarget({
        sessionId,
        topicId: topic.id,
        currentTagId: topic.tagId ?? null,
      });
  }, [isGroupSession, sessionId, setTopicTagTarget, topic.id, topic.tagId]);

  return (
    <TopicItem
      isActive={activeTopicId === topic.id}
      isGroup={isGroupSession}
      topic={topic}
      onDelete={onDelete}
      onFavorite={onFavorite}
      onMoveToTag={onMoveToTag}
      onPress={onPress}
      onRename={onRename}
      onSmartRename={onSmartRename}
    />
  );
});

export default function TopicListScreen({ route, navigation }: RootStackScreenProps<'TopicList'>) {
  const sessionId = route.params.sessionId;
  const sessionKey = sessionId ?? '__invalid_session__';
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();

  const session = useSessionStore((s) => s.sessions.find((x) => x.id === sessionId));
  const isGroupSession = session?.type === 'group';
  const activeTopic = useTopicStore((s) => s.activeTopicBySession[sessionKey] ?? null);
  const topics = useTopicStore((s) => s.topicsBySession[sessionKey] ?? EMPTY_TOPICS);
  const loading = useTopicStore((s) => s.loadingBySession[sessionKey] ?? false);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);
  const createTopic = useTopicStore((s) => s.createTopic);
  const removeTopic = useTopicStore((s) => s.removeTopic);
  const switchTopic = useTopicStore((s) => s.switchTopic);
  const favoriteTopic = useTopicStore((s) => s.favoriteTopic);
  const updateTopic = useTopicStore((s) => s.updateTopic);
  const updateTopicTag = useTopicStore((s) => s.updateTopicTag);
  const fetchMessages = useChatStore((s) => s.fetchMessages);

  const [tags, setTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([]);
  const [topicTagTarget, setTopicTagTarget] = useState<{
    sessionId: string;
    topicId: string;
    currentTagId?: string | null;
  } | null>(null);

  const handleSmartRename = useCallback(
    async (topicId: string) => {
      if (!sessionId) return;
      const failMessage = [t.toastTitleGenerationFailed, t.toastTitleGenerationFailedHint]
        .filter(Boolean)
        .join(' ');
      try {
        const result = await generateBestTitle({ force: true, sessionId, topicId });
        if (result?.title) {
          haptics.success();
          toast.show('success', result.target === 'topic' ? t.topicRenamed : t.sessionRenamed);
        } else {
          toast.show('error', failMessage || 'Failed to generate title');
        }
      } catch {
        toast.show('error', failMessage || 'Failed to generate title');
      }
    },
    [sessionId, t, toast],
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

  useEffect(() => {
    tagApi
      .list()
      .then((list) => setTags(list ?? []))
      .catch(() => setTags([]));
  }, []);

  const handleMoveTopicToTag = useCallback(
    async (topicId: string, sid: string, tagId?: string | null) => {
      try {
        await updateTopicTag(topicId, sid, tagId);
        haptics.success();
        toast.show('success', t.topicRenamed);
        setTopicTagTarget(null);
        void fetchTopics(sessionId);
      } catch (err) {
        const { messageKey, type } = classifyError(err);
        toast.show('error', t[messageKey], {
          onRetry: type === 'auth' ? navigateToLogin : undefined,
          retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
        });
      }
    },
    [fetchTopics, sessionId, t, toast, updateTopicTag],
  );

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

  const renderTopicItem = useCallback(
    ({ item }: { item: Topic }) => {
      if (!sessionId) return null;

      return (
        <TopicListRow
          activeTopicId={activeTopic}
          favoriteTopic={favoriteTopic}
          handleSmartRename={handleSmartRename}
          handleSwitchTopic={handleSwitchTopic}
          isGroupSession={isGroupSession}
          removeTopic={removeTopic}
          sessionId={sessionId}
          setTopicTagTarget={setTopicTagTarget}
          topic={item}
          updateTopic={updateTopic}
        />
      );
    },
    [
      activeTopic,
      favoriteTopic,
      handleSmartRename,
      handleSwitchTopic,
      isGroupSession,
      removeTopic,
      sessionId,
      updateTopic,
    ],
  );

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
        <SearchField
          placeholder={t.topicSearch}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <Animated.View entering={enteringSection(40)}>
        <SelectionListItem
          className="mx-5 mb-2"
          selected={activeTopic === null}
          title={t.topicAllMessages}
          leading={
            <MessageCircle
              color={activeTopic === null ? colors.primary : colors.secondaryText}
              size={18}
              strokeWidth={tokens.icon.strokeWidth}
            />
          }
          onPress={() => handleSwitchTopic(null)}
        />
      </Animated.View>

      <FlatList
        data={sortedTopics}
        keyExtractor={(item) => item.id}
        renderItem={renderTopicItem}
        ListEmptyComponent={
          loading ? (
            <ListSkeleton />
          ) : (
            <EmptyState description={t.topicEmptyDesc} iconVariant="topic" title={t.topicEmpty} />
          )
        }
        contentContainerStyle={
          sortedTopics.length === 0
            ? { flexGrow: 1, justifyContent: 'center', paddingBottom: 30 }
            : { paddingBottom: 30 }
        }
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={onRefresh}
          />
        }
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

      {/* Topic tag picker modal (for non-group topics) */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={!!topicTagTarget}
        onRequestClose={() => setTopicTagTarget(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setTopicTagTarget(null)}
        >
          <Pressable
            className="bg-card rounded-t-2xl pb-8 max-h-[70%]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <Text className="px-5 pb-3 text-[16px] font-semibold text-foreground">
              {t.tagMoveSession}
            </Text>
            <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 24 }}>
              <Pressable
                className="flex-row items-center justify-between rounded-xl px-3 py-3.5 active:bg-foreground/5"
                onPress={() =>
                  topicTagTarget &&
                  sessionId &&
                  void handleMoveTopicToTag(topicTagTarget.topicId, topicTagTarget.sessionId, null)
                }
              >
                <View className="flex-row items-center">
                  <View
                    className="mr-3 h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: colors.secondaryText }}
                  />
                  <Text className="text-[15px] font-medium text-foreground">{t.tagNone}</Text>
                </View>
                {!topicTagTarget?.currentTagId ? (
                  <Check color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                ) : null}
              </Pressable>
              {tags.map((tag) => (
                <Pressable
                  className="flex-row items-center justify-between rounded-xl px-3 py-3.5 active:bg-foreground/5"
                  key={tag.id}
                  onPress={() =>
                    topicTagTarget &&
                    void handleMoveTopicToTag(
                      topicTagTarget.topicId,
                      topicTagTarget.sessionId,
                      tag.id,
                    )
                  }
                >
                  <View className="flex-row items-center">
                    <View
                      className="mr-3 h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: resolveTagColor(tag.color) }}
                    />
                    <Text className="text-[15px] font-medium text-foreground">{tag.name}</Text>
                  </View>
                  {topicTagTarget?.currentTagId === tag.id ? (
                    <Check color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
