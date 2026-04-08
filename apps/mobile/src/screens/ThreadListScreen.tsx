import { useFocusEffect } from '@react-navigation/native';
import {
  ArrowLeft,
  ChevronRight,
  GitBranch,
  MessageCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import EmptyState from '../components/ui/EmptyState';
import PortalScaffold from '../components/ui/PortalScaffold';
import { HeaderIconButton } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { threadApi } from '../lib/api';
import { formatMobileDate } from '../lib/dateTime';
import { haptics } from '../lib/haptics';
import type { I18nStore } from '../lib/i18n';
import { useI18n } from '../lib/i18n';
import { navigateBackFromPortal, navigateToConversationOrigin } from '../lib/navigation';
import { appendCurrentPortalStack } from '../lib/portalNavigation';
import type { RootStackScreenProps } from '../navigation/types';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { MobileThreadItem } from '../types';

const formatThreadStatusLabel = (status: string | null | undefined, t: I18nStore['t']) => {
  switch (status) {
    case 'completed': {
      return t.threadStatusCompleted;
    }
    case 'failed': {
      return t.threadStatusFailed;
    }
    case 'interrupted': {
      return t.threadStatusInterrupted;
    }
    case 'in_review': {
      return t.threadStatusInReview;
    }
    case 'processing': {
      return t.threadStatusProcessing;
    }
    default: {
      return status || t.threadStatusProcessing;
    }
  }
};

const formatThreadTypeLabel = (type: string | null | undefined, t: I18nStore['t']) => {
  switch (type) {
    case 'continuation': {
      return t.threadTypeContinuation;
    }
    case 'standalone': {
      return t.threadTypeStandalone;
    }
    case 'isolation': {
      return t.threadTypeIsolation;
    }
    default: {
      return type || null;
    }
  }
};

export default function ThreadListScreen({
  navigation,
  route,
}: RootStackScreenProps<'ThreadList'>) {
  const { sessionId, topicId } = route.params;
  const { t } = useI18n();
  const colors = useThemeColors();
  const toast = useToast();
  const [threads, setThreads] = useState<MobileThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const handleOpenConversation = useCallback(() => {
    navigateToConversationOrigin({ sessionId, topicId });
  }, [sessionId, topicId]);
  const handleBack = useCallback(() => {
    navigateBackFromPortal({
      conversationOrigin: { sessionId, ...(topicId ? { topicId } : {}) },
      navigation,
      portalStack: route.params.portalStack,
    });
  }, [navigation, route.params.portalStack, sessionId, topicId]);

  const loadThreads = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);

      try {
        const nextThreads = await threadApi.list(topicId);
        setThreads(nextThreads ?? []);
      } catch {
        toast.show('error', t.threadLoadFailed);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t.threadLoadFailed, toast, topicId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadThreads(true);
    }, [loadThreads]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadThreads();
  }, [loadThreads]);

  const handleDeleteThread = useCallback(
    (thread: MobileThreadItem) => {
      Alert.alert(t.threadDeleteConfirm, thread.title || t.threadUntitled, [
        { text: t.cancel, style: 'cancel' },
        {
          text: t.delete,
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await threadApi.remove(thread.id);
                setThreads((prev) => prev.filter((item) => item.id !== thread.id));
                haptics.success();
                toast.show('success', t.threadDeleted);
              } catch {
                toast.show('error', t.threadDeleteFailed);
              }
            })();
          },
        },
      ]);
    },
    [t, toast],
  );

  const listEmpty = useMemo(
    () => <EmptyState description={t.threadEmptyDesc} iconVariant="chat" title={t.threadEmpty} />,
    [t.threadEmpty, t.threadEmptyDesc],
  );

  return (
    <PortalScaffold
      portalCurrentLabel={t.threadListTitle}
      portalRouteName={route.name}
      portalRouteParams={route.params}
      subtitle={topicId}
      title={t.threadListTitle}
      leftElement={
        <ArrowLeft color={colors.foreground} size={20} strokeWidth={tokens.icon.strokeWidth} />
      }
      rightActions={
        <View className="flex-row items-center" style={{ gap: 6 }}>
          <HeaderIconButton
            accessibilityHint={t.chatOpenConversation}
            accessibilityLabel={t.chatOpenConversation}
            onPress={handleOpenConversation}
          >
            <MessageCircle color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </HeaderIconButton>
          <HeaderIconButton onPress={() => void loadThreads()}>
            <RefreshCw color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </HeaderIconButton>
        </View>
      }
      onDismiss={handleBack}
      onPressLeft={handleBack}
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          ListEmptyComponent={listEmpty}
          contentContainerStyle={threads.length === 0 ? { flex: 1 } : { paddingVertical: 12 }}
          data={threads}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={handleRefresh}
            />
          }
          renderItem={({ item }) => {
            const subtitle = [
              formatThreadStatusLabel(item.status, t),
              formatThreadTypeLabel(item.type, t),
              item.updatedAt ? formatMobileDate(item.updatedAt) : null,
            ]
              .filter(Boolean)
              .join('  ·  ');

            return (
              <TouchableOpacity
                activeOpacity={0.76}
                className="mx-4 mb-3 rounded-3xl border px-4 py-4"
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.borderSubtle,
                }}
                onLongPress={() => handleDeleteThread(item)}
                onPress={() =>
                  navigation.navigate('ThreadDetail', {
                    ...appendCurrentPortalStack(route.name, route.params, {}),
                    sessionId,
                    threadId: item.id,
                    title: item.title ?? undefined,
                    topicId,
                  })
                }
              >
                <View className="flex-row items-start">
                  <View
                    className="mr-3 items-center justify-center rounded-2xl"
                    style={{
                      backgroundColor: colors.primarySubtle,
                      height: 42,
                      width: 42,
                    }}
                  >
                    <GitBranch color={colors.primary} size={18} strokeWidth={2} />
                  </View>
                  <View className="min-w-0 flex-1">
                    <Text className="text-[15px] font-semibold text-foreground" numberOfLines={2}>
                      {item.title?.trim() || t.threadUntitled}
                    </Text>
                    <Text
                      className="mt-1 text-[12px]"
                      numberOfLines={2}
                      style={{ color: colors.secondaryText }}
                    >
                      {subtitle}
                    </Text>
                  </View>
                  <TouchableOpacity
                    accessibilityLabel={t.delete}
                    className="ml-2 h-9 w-9 items-center justify-center rounded-full"
                    hitSlop={8}
                    onPress={() => handleDeleteThread(item)}
                  >
                    <Trash2 color={colors.danger} size={16} strokeWidth={tokens.icon.strokeWidth} />
                  </TouchableOpacity>
                  <View className="ml-1 h-9 w-9 items-center justify-center rounded-full">
                    <ChevronRight
                      color={colors.secondaryText}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </PortalScaffold>
  );
}
