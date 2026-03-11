/**
 * TopicListScreen — Lists topics for a session with search, create, and management.
 */
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import PressableScale from '../components/ui/PressableScale';
import { useToast } from '../components/ui/Toast';
import TopicItem from '../components/ui/TopicItem';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useChatStore } from '../store/chat';
import { useTopicStore } from '../store/topic';
import { tokens } from '../theme/tokens';

export default function TopicListScreen({ route, navigation }: any) {
  const sessionId = route.params?.sessionId;
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();
  const toast = useToast();

  const topics = useTopicStore((s) => s.topics);
  const activeTopic = useTopicStore((s) => s.activeTopic);
  const loading = useTopicStore((s) => s.loading);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);
  const createTopic = useTopicStore((s) => s.createTopic);
  const removeTopic = useTopicStore((s) => s.removeTopic);
  const switchTopic = useTopicStore((s) => s.switchTopic);
  const favoriteTopic = useTopicStore((s) => s.favoriteTopic);
  const updateTopic = useTopicStore((s) => s.updateTopic);
  const fetchMessages = useChatStore((s) => s.fetchMessages);

  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (sessionId) fetchTopics(sessionId);
  }, [sessionId, fetchTopics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await fetchTopics(sessionId);
    setRefreshing(false);
  }, [fetchTopics, sessionId]);

  const handleCreateTopic = useCallback(() => {
    Alert.prompt(
      t.topicCreate,
      undefined,
      async (title) => {
        if (title?.trim()) {
          haptics.success();
          await createTopic(sessionId, title.trim());
          toast.show('success', t.toastTopicCreated);
        }
      },
      'plain-text',
      '',
      t.topicCreatePlaceholder,
    );
  }, [t, createTopic, sessionId, toast]);

  const handleSwitchTopic = useCallback(
    (topicId: string | null) => {
      switchTopic(topicId);
      fetchMessages(sessionId, topicId ?? undefined);
      navigation.goBack();
    },
    [switchTopic, fetchMessages, sessionId, navigation],
  );

  const filteredTopics = searchQuery
    ? topics.filter((tp) => tp.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : topics;

  // Sort: favorites first, then by date
  const sortedTopics = [...filteredTopics].sort((a, b) => {
    if (a.favorite && !b.favorite) return -1;
    if (!a.favorite && b.favorite) return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-2.5">
        <PressableScale
          className="w-9 h-9 items-center justify-center rounded-full"
          onPress={() => {
            haptics.light();
            navigation.goBack();
          }}
        >
          <ArrowLeft
            color={isDark ? '#fff' : '#111'}
            size={22}
            strokeWidth={tokens.icon.strokeWidth}
          />
        </PressableScale>
        <Text className="text-[17px] font-semibold text-foreground">{t.topicTitle}</Text>
        <PressableScale
          className="w-9 h-9 items-center justify-center rounded-full"
          onPress={handleCreateTopic}
        >
          <Plus color="#007aff" size={22} strokeWidth={tokens.icon.strokeWidth} />
        </PressableScale>
      </View>

      {/* Search */}
      <View className="px-4 pb-3">
        <View className="bg-foreground/5 dark:bg-white/5 rounded-xl px-4 py-2.5 flex-row items-center">
          <TextInput
            className="flex-1 text-foreground text-[15px]"
            placeholder={t.topicSearch}
            placeholderTextColor={isDark ? '#636366' : '#8c8c8c'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* "All Messages" button — switches to null topic */}
      <Animated.View entering={FadeInDown.delay(50).duration(250)}>
        <TouchableOpacity
          activeOpacity={0.6}
          className={`flex-row items-center px-5 py-3.5 rounded-xl mx-3 mb-2 ${
            activeTopic === null ? 'bg-primary/10' : 'active:bg-foreground/5'
          }`}
          onPress={() => handleSwitchTopic(null)}
        >
          <MessageCircle
            color={activeTopic === null ? '#007aff' : isDark ? '#888' : '#666'}
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

      {/* Topic List */}
      <FlatList
        contentContainerStyle={{ paddingBottom: 30 }}
        data={sortedTopics}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          !loading ? (
            <View className="items-center pt-16 px-8">
              <Text className="text-secondary/50 text-[15px] font-medium">{t.topicEmpty}</Text>
              <Text className="text-secondary/40 text-[13px] mt-1 text-center">
                {t.topicEmptyDesc}
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            colors={['#007aff']}
            refreshing={refreshing}
            tintColor={isDark ? '#0a84ff' : '#007aff'}
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
            onRename={(newTitle) => updateTopic(item.id, newTitle)}
          />
        )}
      />
    </View>
  );
}
