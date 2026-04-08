import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, GitBranch, MessageCircle } from 'lucide-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import EmptyState from '../components/ui/EmptyState';
import MessageBubble from '../components/ui/MessageBubble';
import PortalScaffold from '../components/ui/PortalScaffold';
import { HeaderIconButton } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { messageApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { navigateBackFromPortal, navigateToConversationOrigin } from '../lib/navigation';
import { isGroupSessionLike } from '../lib/session';
import type { RootStackScreenProps } from '../navigation/types';
import { useSessionStore } from '../store/session';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { ChatMessage } from '../types';

export default function MessageDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<'MessageDetail'>) {
  const { messageId, sessionId, threadId, title, topicId } = route.params;
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const session = useSessionStore((s) => s.sessions.find((item) => item.id === sessionId));
  const isGroupSession = isGroupSessionLike(sessionId, session?.type);
  const [message, setMessage] = useState<ChatMessage | null>(route.params.message ?? null);
  const [loading, setLoading] = useState(!route.params.message);
  const originActionLabel = threadId ? t.threadOpen : t.chatOpenConversation;
  const handleOpenOrigin = useCallback(() => {
    navigateToConversationOrigin({ sessionId, threadId, topicId });
  }, [sessionId, threadId, topicId]);

  const handleBack = useCallback(() => {
    navigateBackFromPortal({
      conversationOrigin: {
        sessionId,
        ...(threadId ? { threadId } : {}),
        ...(topicId ? { topicId } : {}),
      },
      navigation,
      portalStack: route.params.portalStack,
    });
  }, [navigation, route.params.portalStack, sessionId, threadId, topicId]);

  const loadMessage = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);

      try {
        const messages = await messageApi.list(sessionId, topicId, {
          sessionType: isGroupSession ? 'group' : 'agent',
          ...(threadId ? { threadId } : {}),
        });
        const matchedMessage = messages.find((item) => item.id === messageId) ?? null;

        setMessage(matchedMessage);
        if (!matchedMessage) {
          toast.show('error', t.messageDetailLoadFailed);
        }
      } catch {
        toast.show('error', t.messageDetailLoadFailed);
        setMessage(null);
      } finally {
        setLoading(false);
      }
    },
    [isGroupSession, messageId, sessionId, t.messageDetailLoadFailed, threadId, toast, topicId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadMessage(!route.params.message);
    }, [loadMessage, route.params.message]),
  );

  const emptyState = useMemo(
    () => (
      <EmptyState
        compact
        description={t.messageDetailEmptyDesc}
        iconVariant="chat"
        title={t.messageDetailEmpty}
      />
    ),
    [t.messageDetailEmpty, t.messageDetailEmptyDesc],
  );

  return (
    <PortalScaffold
      portalCurrentLabel={title?.trim() || t.messageDetailTitle}
      portalRouteName={route.name}
      portalRouteParams={route.params}
      subtitle={messageId}
      title={title?.trim() || t.messageDetailTitle}
      leftElement={
        <ArrowLeft color={colors.foreground} size={20} strokeWidth={tokens.icon.strokeWidth} />
      }
      rightActions={
        <HeaderIconButton
          accessibilityHint={originActionLabel}
          accessibilityLabel={originActionLabel}
          onPress={handleOpenOrigin}
        >
          {threadId ? (
            <GitBranch color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          ) : (
            <MessageCircle color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
          )}
        </HeaderIconButton>
      }
      onDismiss={handleBack}
      onPressLeft={handleBack}
    >
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : message ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: 24,
            paddingTop: 16,
          }}
        >
          <MessageBubble
            disableMessageDetailNavigation
            disableToolActions
            readOnly
            message={message}
            sessionId={sessionId}
            topicId={topicId ?? null}
          />
        </ScrollView>
      ) : (
        <View className="flex-1 items-center justify-center px-5">{emptyState}</View>
      )}
    </PortalScaffold>
  );
}
