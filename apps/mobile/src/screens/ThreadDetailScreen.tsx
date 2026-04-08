import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ComposerPrimaryAction, ComposerShell } from '../components/ui/ComposerShell';
import EmptyState from '../components/ui/EmptyState';
import MessageBubble from '../components/ui/MessageBubble';
import PortalKeyboardScaffold from '../components/ui/PortalKeyboardScaffold';
import { HeaderIconButton } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import {
  aiChatApi,
  messageApi,
  type StreamContentState,
  type StreamReasoningState,
  threadApi,
  type ToolExecutionItem,
} from '../lib/api';
import { useI18n } from '../lib/i18n';
import { navigateBackFromPortal, navigateToConversationOrigin } from '../lib/navigation';
import { isGroupSessionLike } from '../lib/session';
import type { RootStackScreenProps } from '../navigation/types';
import {
  buildAssistantMessageMetadata,
  buildContextMessage,
  buildPersistedReasoning,
  buildReasoningState,
  mergeMessageMetadata,
} from '../store/chat';
import {
  getSessionChatOptions,
  mergeResolvedToolPayloads,
  resolveProviderByModel,
} from '../store/chatHelpers';
import { useSessionStore } from '../store/session';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type { ChatMessage, ChatToolPayload } from '../types';

export default function ThreadDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<'ThreadDetail'>) {
  const { sessionId, threadId, title, topicId } = route.params;
  const { t } = useI18n();
  const colors = useThemeColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const session = useSessionStore((s) => s.sessions.find((item) => item.id === sessionId));
  const isGroupSession = isGroupSessionLike(sessionId, session?.type);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  const [screenTitle, setScreenTitle] = useState(title?.trim() || t.threadDetailTitle);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAssistantId, setPendingAssistantId] = useState<string | null>(null);
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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const refreshThreadTitle = useCallback(async () => {
    try {
      const nextTitle = await threadApi.generateTitle(threadId);
      if (nextTitle?.trim()) setScreenTitle(nextTitle.trim());
    } catch (error) {
      console.warn('[ThreadDetailScreen] Failed to refresh thread title:', error);
    }
  }, [threadId]);

  const loadMessages = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);

      try {
        const nextMessages = await messageApi.list(sessionId, topicId, {
          sessionType: isGroupSession ? 'group' : 'agent',
          threadId,
        });
        setMessages(nextMessages);
      } catch {
        toast.show('error', t.threadLoadFailed);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isGroupSession, sessionId, t.threadLoadFailed, threadId, toast, topicId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadMessages(true);
      if (!title?.trim()) {
        void refreshThreadTitle();
      }
    }, [loadMessages, refreshThreadTitle, title]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadMessages();
  }, [loadMessages]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    const now = new Date().toISOString();
    const userTempId = `thread-user-${Date.now()}`;
    const assistantTempId = `thread-assistant-${Date.now()}`;
    const optimisticUser: ChatMessage = {
      content: text,
      createdAt: now,
      id: userTempId,
      role: 'user',
      sessionId,
      updatedAt: now,
    };
    const optimisticAssistant: ChatMessage = {
      content: '',
      createdAt: now,
      id: assistantTempId,
      role: 'assistant',
      sessionId,
      updatedAt: now,
    };

    setInputText('');
    setSending(true);
    setPendingAssistantId(assistantTempId);
    setMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);

    const createBaseParams = isGroupSession ? { groupId: sessionId } : { sessionId };
    const contextMessages = [...messagesRef.current, optimisticUser]
      .map(buildContextMessage)
      .filter(
        (message): message is NonNullable<ReturnType<typeof buildContextMessage>> => !!message,
      );

    let userMessageId: string | undefined;
    let shouldReloadThread = false;

    try {
      const createdUser = await messageApi.create({
        ...createBaseParams,
        content: text,
        role: 'user',
        threadId,
        topicId,
      });
      userMessageId = createdUser.id;

      const chatOptions = await getSessionChatOptions(sessionId);
      const provider =
        chatOptions.provider || resolveProviderByModel(chatOptions.model) || 'openai';

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantTempId
            ? {
                ...message,
                model: chatOptions.model,
                provider,
              }
            : message,
        ),
      );

      const result = await aiChatApi.createAssistantMessageStream(
        provider,
        contextMessages,
        {
          ...chatOptions,
          provider,
          sessionId,
          topicId,
        },
        {
          onContent: (contentState: StreamContentState) => {
            setMessages((prev) =>
              prev.map((message) => {
                if (message.id !== assistantTempId) return message;

                const nextMetadata = mergeMessageMetadata(message.metadata, contentState);

                return {
                  ...message,
                  content: contentState.content,
                  ...(nextMetadata ? { metadata: nextMetadata } : {}),
                  updatedAt: new Date().toISOString(),
                };
              }),
            );
          },
          onImages: (images) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? { ...message, imageList: images, updatedAt: new Date().toISOString() }
                  : message,
              ),
            );
          },
          onPerformance: (performance) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? {
                      ...message,
                      performance: performance as any,
                      updatedAt: new Date().toISOString(),
                    }
                  : message,
              ),
            );
          },
          onReasoning: (reasoningState: StreamReasoningState) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? {
                      ...message,
                      reasoning: buildReasoningState(reasoningState),
                      updatedAt: new Date().toISOString(),
                    }
                  : message,
              ),
            );
          },
          onSearch: (search) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? { ...message, search, updatedAt: new Date().toISOString() }
                  : message,
              ),
            );
          },
          onToolExecutions: (executions) => {
            setMessages((prev) =>
              prev.map((message) => {
                if (message.id !== assistantTempId) return message;

                const resolvedTools = mergeResolvedToolPayloads(
                  message.tools ?? undefined,
                  executions,
                );

                return resolvedTools
                  ? { ...message, tools: resolvedTools, updatedAt: new Date().toISOString() }
                  : message;
              }),
            );
          },
          onTools: (tools) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? { ...message, tools, updatedAt: new Date().toISOString() }
                  : message,
              ),
            );
          },
          onUsage: (usage) => {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantTempId
                  ? { ...message, usage: usage as any, updatedAt: new Date().toISOString() }
                  : message,
              ),
            );
          },
        },
      );

      const localAssistant = messagesRef.current.find((message) => message.id === assistantTempId);
      const resolvedTools = mergeResolvedToolPayloads(result.tools, result.toolExecutions);

      try {
        await messageApi.create({
          ...createBaseParams,
          ...(result.images ? { imageList: result.images } : {}),
          ...(result.search ? { search: result.search } : {}),
          ...(resolvedTools ? { tools: resolvedTools } : {}),
          content: result.text,
          metadata: buildAssistantMessageMetadata(
            result.performance,
            result.usage,
            localAssistant?.metadata,
          ),
          model: chatOptions.model,
          parentId: userMessageId,
          provider,
          reasoning: buildPersistedReasoning(localAssistant?.reasoning),
          role: 'assistant',
          threadId,
          topicId,
        });
        shouldReloadThread = true;
      } catch (error) {
        console.warn('[ThreadDetailScreen] Failed to persist assistant message:', error);
      }

      if (!title?.trim()) {
        void refreshThreadTitle();
      }
    } catch (error) {
      if (userMessageId) shouldReloadThread = true;

      const errorMessage =
        error instanceof Error && error.message.trim() ? error.message : t.threadSendFailed;
      toast.show('error', errorMessage);

      if (!userMessageId) {
        setMessages((prev) =>
          prev.filter((message) => message.id !== userTempId && message.id !== assistantTempId),
        );
        setInputText(text);
      }
    } finally {
      if (shouldReloadThread) {
        await loadMessages(false);
      }
      setPendingAssistantId(null);
      setSending(false);
    }
  }, [
    inputText,
    isGroupSession,
    loadMessages,
    refreshThreadTitle,
    sending,
    sessionId,
    t.threadSendFailed,
    threadId,
    title,
    toast,
    topicId,
  ]);

  const listEmpty = useMemo(
    () => <EmptyState description={t.threadEmptyDesc} iconVariant="chat" title={t.threadEmpty} />,
    [t.threadEmpty, t.threadEmptyDesc],
  );

  const lastContextMessageIndex = useMemo(() => {
    let lastIndex = -1;

    for (const [index, message] of messages.entries()) {
      if (!message.threadId) lastIndex = index;
    }

    return lastIndex;
  }, [messages]);

  const canSend = inputText.trim().length > 0 && !sending;
  const updateThreadMessage = useCallback(
    (messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
      setMessages((prev) =>
        prev.map((message) => (message.id === messageId ? updater(message) : message)),
      );
    },
    [],
  );

  const applyThreadToolExecutions = useCallback(
    (assistantMessageId: string, executions: ToolExecutionItem[], tools?: ChatToolPayload[]) => {
      const baseTools =
        tools ?? messagesRef.current.find((message) => message.id === assistantMessageId)?.tools;
      const resolvedTools = mergeResolvedToolPayloads(baseTools ?? undefined, executions);
      if (!resolvedTools) return;

      updateThreadMessage(assistantMessageId, (message) => ({
        ...message,
        tools: resolvedTools,
        updatedAt: new Date().toISOString(),
      }));
    },
    [updateThreadMessage],
  );

  const runThreadToolIntervention = useCallback(
    async (
      assistantMessageId: string,
      params:
        | { approvedToolCall: ChatToolPayload }
        | { rejectedToolCall: { id: string; reason?: string } },
    ) => {
      try {
        const chatOptions = await getSessionChatOptions(sessionId);
        const provider =
          chatOptions.provider || resolveProviderByModel(chatOptions.model) || 'openai';

        const result = await aiChatApi.continueToolIntervention(
          provider,
          { ...params, sessionId, topicId },
          {
            onContent: (state) => {
              updateThreadMessage(assistantMessageId, (message) => ({
                ...message,
                content: state.content,
                updatedAt: new Date().toISOString(),
              }));
            },
            onTools: (tools) => {
              updateThreadMessage(assistantMessageId, (message) => ({
                ...message,
                tools,
                updatedAt: new Date().toISOString(),
              }));
            },
            onToolExecutions: (executions) => {
              applyThreadToolExecutions(assistantMessageId, executions);
            },
          },
        );

        if (result.tools) {
          const resolvedTools = mergeResolvedToolPayloads(result.tools, result.toolExecutions);
          updateThreadMessage(assistantMessageId, (message) => ({
            ...message,
            ...(result.text ? { content: result.text } : {}),
            tools: resolvedTools || result.tools,
            updatedAt: new Date().toISOString(),
          }));
        } else if (result.toolExecutions) {
          applyThreadToolExecutions(assistantMessageId, result.toolExecutions);
          if (result.text) {
            updateThreadMessage(assistantMessageId, (message) => ({
              ...message,
              content: result.text,
              updatedAt: new Date().toISOString(),
            }));
          }
        } else if (result.text) {
          updateThreadMessage(assistantMessageId, (message) => ({
            ...message,
            content: result.text,
            updatedAt: new Date().toISOString(),
          }));
        }

        await loadMessages(false);
      } catch (error) {
        const errorMessage =
          error instanceof Error && error.message.trim() ? error.message : t.errorSendFailed;
        toast.show('error', errorMessage);
      }
    },
    [
      applyThreadToolExecutions,
      loadMessages,
      sessionId,
      t.errorSendFailed,
      toast,
      topicId,
      updateThreadMessage,
    ],
  );

  const rejectThreadToolCall = useCallback(
    (messageId: string, toolId: string, reason?: string) => {
      updateThreadMessage(messageId, (message) => {
        if (!message.tools?.length) return message;

        return {
          ...message,
          tools: message.tools.map((tool) =>
            tool.id === toolId
              ? { ...tool, intervention: { rejectedReason: reason, status: 'rejected' as const } }
              : tool,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateThreadMessage],
  );

  const rejectThreadToolMessage = useCallback(
    (messageId: string, reason?: string) => {
      updateThreadMessage(messageId, (message) => {
        if (message.role !== 'tool') return message;

        const intervention = { rejectedReason: reason, status: 'rejected' as const };

        return {
          ...message,
          plugin: message.plugin ? { ...message.plugin, intervention } : message.plugin,
          pluginIntervention: intervention,
          updatedAt: new Date().toISOString(),
        };
      });
    },
    [updateThreadMessage],
  );

  const threadToolActionHandlers = useMemo(
    () => ({
      continueToolIntervention: (assistantMessageId: string, approvedTool: ChatToolPayload) =>
        runThreadToolIntervention(assistantMessageId, { approvedToolCall: approvedTool }),
      rejectAndContinueToolIntervention: (assistantMessageId: string, toolId: string) =>
        runThreadToolIntervention(assistantMessageId, { rejectedToolCall: { id: toolId } }),
      rejectToolCall: rejectThreadToolCall,
      rejectToolMessage: rejectThreadToolMessage,
    }),
    [rejectThreadToolCall, rejectThreadToolMessage, runThreadToolIntervention],
  );

  const renderMessage = useCallback(
    ({ item, index }: { index: number; item: ChatMessage }) => {
      const isContextMessage = !item.threadId;
      const isGenerating = sending && item.id === pendingAssistantId;
      const showThreadDivider =
        lastContextMessageIndex >= 0 &&
        index === lastContextMessageIndex &&
        lastContextMessageIndex < messages.length - 1;

      return (
        <View>
          {isContextMessage ? (
            <View
              className="mb-3 rounded-3xl border py-3"
              style={{
                backgroundColor: colors.fillTertiary,
                borderColor: colors.primaryBorder,
              }}
            >
              <View className="px-4 pb-1">
                <View
                  className="self-start rounded-full px-2.5 py-1"
                  style={{ backgroundColor: colors.primarySubtle }}
                >
                  <Text className="text-[11px] font-semibold" style={{ color: colors.primary }}>
                    {t.threadContextLabel}
                  </Text>
                </View>
              </View>
              <MessageBubble
                disableToolActions
                readOnly
                generating={isGenerating}
                isReasoning={isGenerating && !item.content.trim()}
                message={item}
                sessionId={sessionId}
                topicId={topicId ?? null}
              />
            </View>
          ) : (
            <MessageBubble
              readOnly
              disableToolActions={false}
              generating={isGenerating}
              isReasoning={isGenerating && !item.content.trim()}
              message={item}
              sessionId={sessionId}
              toolActionHandlers={threadToolActionHandlers}
              topicId={topicId ?? null}
            />
          )}

          {showThreadDivider ? (
            <View className="flex-row items-center px-2 py-3">
              <View className="h-px flex-1" style={{ backgroundColor: colors.borderSubtle }} />
              <Text
                className="mx-3 text-[11px] font-semibold"
                style={{ color: colors.secondaryText }}
              >
                {t.threadStartDivider}
              </Text>
              <View className="h-px flex-1" style={{ backgroundColor: colors.borderSubtle }} />
            </View>
          ) : null}
        </View>
      );
    },
    [
      colors.borderSubtle,
      colors.fillTertiary,
      colors.primary,
      colors.primaryBorder,
      colors.primarySubtle,
      colors.secondaryText,
      lastContextMessageIndex,
      messages.length,
      pendingAssistantId,
      sending,
      sessionId,
      t.threadContextLabel,
      t.threadStartDivider,
      threadToolActionHandlers,
      topicId,
    ],
  );

  return (
    <PortalKeyboardScaffold
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      portalCurrentLabel={screenTitle}
      portalRouteName={route.name}
      portalRouteParams={route.params}
      subtitle={threadId}
      title={screenTitle}
      leftElement={
        <ArrowLeft color={colors.foreground} size={20} strokeWidth={tokens.icon.strokeWidth} />
      }
      rightActions={
        <HeaderIconButton
          accessibilityHint={t.chatOpenConversation}
          accessibilityLabel={t.chatOpenConversation}
          onPress={handleOpenConversation}
        >
          <MessageCircle color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
        </HeaderIconButton>
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
          data={messages}
          keyExtractor={(item) => item.id}
          ref={listRef}
          renderItem={renderMessage}
          contentContainerStyle={
            messages.length === 0
              ? { flex: 1 }
              : {
                  gap: 12,
                  paddingBottom: 16,
                  paddingHorizontal: 16,
                  paddingTop: 16,
                }
          }
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={handleRefresh}
            />
          }
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: true });
          }}
        />
      )}

      <View
        style={{
          paddingBottom: Math.max(insets.bottom, 12),
          paddingHorizontal: 16,
          paddingTop: 8,
        }}
      >
        <ComposerShell active={sending || canSend}>
          <View className="flex-row items-end px-3 py-2">
            <TextInput
              multiline
              className="flex-1 text-[16px] leading-[22px] text-foreground"
              editable={!sending}
              placeholder={sending ? t.chatGenerating : t.threadInputPlaceholder}
              placeholderTextColor={colors.secondaryText}
              value={inputText}
              style={{
                maxHeight: 120,
                minHeight: 40,
                paddingRight: 12,
                paddingTop: 2,
                textAlignVertical: 'top',
              }}
              onChangeText={setInputText}
            />
            <ComposerPrimaryAction
              active={canSend}
              disabled={!canSend}
              onPress={() => {
                void handleSend();
              }}
            >
              {sending ? (
                <ActivityIndicator color={colors.iconOnPrimary} size="small" />
              ) : (
                <Send
                  color={canSend ? colors.iconOnPrimary : colors.muted}
                  size={18}
                  strokeWidth={2.2}
                />
              )}
            </ComposerPrimaryAction>
          </View>
        </ComposerShell>
      </View>
    </PortalKeyboardScaffold>
  );
}
