import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, MessageCircle, Send } from 'lucide-react-native';
import React, {
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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

const THREAD_STREAM_THROTTLE_MS = 100;

const findThreadMessageIndexFromEnd = (messages: ChatMessage[], messageId: string) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.id === messageId) return index;
  }

  return -1;
};

const getThreadMessageById = (messages: ChatMessage[], messageId: string) => {
  if (messages.length === 0) return undefined;

  const lastMessage = messages.at(-1);
  if (lastMessage?.id === messageId) return lastMessage;

  const messageIndex = findThreadMessageIndexFromEnd(messages, messageId);
  return messageIndex >= 0 ? messages[messageIndex] : undefined;
};

const updateThreadMessageRecord = (
  messages: ChatMessage[],
  messageId: string,
  updater: (message: ChatMessage) => ChatMessage,
) => {
  if (messages.length === 0) return messages;

  const lastIndex = messages.length - 1;
  const targetIndex =
    messages.at(-1)?.id === messageId
      ? lastIndex
      : findThreadMessageIndexFromEnd(messages, messageId);

  if (targetIndex < 0) return messages;

  const currentMessage = messages[targetIndex];
  const nextMessage = updater(currentMessage);
  if (nextMessage === currentMessage) return messages;

  const nextMessages = messages.slice();
  nextMessages[targetIndex] = nextMessage;
  return nextMessages;
};

export default function ThreadDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<'ThreadDetail'>) {
  const { sessionId, sourceMessageId, threadId, threadType, title, topicId } = route.params;
  const { t } = useI18n();
  const colors = useThemeColors();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const session = useSessionStore((s) => s.sessions.find((item) => item.id === sessionId));
  const isGroupSession = isGroupSessionLike(sessionId, session?.type);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const initialThreadId = threadId?.trim() || undefined;
  const normalizedSourceMessageId = sourceMessageId?.trim() || undefined;
  const normalizedTopicId = topicId?.trim() || undefined;

  const [screenTitle, setScreenTitle] = useState(title?.trim() || t.threadDetailTitle);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [pendingAssistantId, setPendingAssistantId] = useState<string | null>(null);
  const [currentThreadId, setCurrentThreadId] = useState(initialThreadId);
  const activeThreadId = currentThreadId?.trim() || undefined;
  const isDraftThread =
    !activeThreadId && !!normalizedSourceMessageId && !!normalizedTopicId && !!threadType;
  const handleOpenConversation = useCallback(() => {
    navigateToConversationOrigin({ sessionId, topicId: normalizedTopicId });
  }, [normalizedTopicId, sessionId]);
  const handleBack = useCallback(() => {
    navigateBackFromPortal({
      conversationOrigin: {
        sessionId,
        ...(normalizedTopicId ? { topicId: normalizedTopicId } : {}),
      },
      navigation,
      portalStack: route.params.portalStack,
    });
  }, [navigation, normalizedTopicId, route.params.portalStack, sessionId]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    setCurrentThreadId(initialThreadId);
  }, [initialThreadId]);

  useEffect(() => {
    setScreenTitle(title?.trim() || t.threadDetailTitle);
  }, [initialThreadId, normalizedSourceMessageId, t.threadDetailTitle, threadType, title]);

  const setThreadMessages = useCallback((value: SetStateAction<ChatMessage[]>) => {
    setMessages((prev) => {
      const nextMessages =
        typeof value === 'function'
          ? (value as (prevState: ChatMessage[]) => ChatMessage[])(prev)
          : value;
      messagesRef.current = nextMessages;
      return nextMessages;
    });
  }, []);

  const updateThreadMessage = useCallback(
    (messageId: string, updater: (message: ChatMessage) => ChatMessage) => {
      setThreadMessages((prev) => updateThreadMessageRecord(prev, messageId, updater));
    },
    [setThreadMessages],
  );

  const refreshThreadTitle = useCallback(
    async (targetThreadId?: string) => {
      const normalizedThreadId = targetThreadId?.trim() || activeThreadId;
      if (!normalizedThreadId) return;

      try {
        const nextTitle = await threadApi.generateTitle(normalizedThreadId);
        if (nextTitle?.trim()) setScreenTitle(nextTitle.trim());
      } catch (error) {
        console.warn('[ThreadDetailScreen] Failed to refresh thread title:', error);
      }
    },
    [activeThreadId],
  );

  const loadMessages = useCallback(
    async (showSpinner = false, targetThreadId?: string) => {
      if (showSpinner) setLoading(true);

      try {
        const normalizedThreadId = targetThreadId?.trim() || activeThreadId;
        const nextMessages = normalizedThreadId
          ? await messageApi.list(sessionId, normalizedTopicId, {
              sessionType: isGroupSession ? 'group' : 'agent',
              threadId: normalizedThreadId,
            })
          : isDraftThread
            ? await messageApi.listThreadDraftMessages({
                sourceMessageId: normalizedSourceMessageId!,
                threadType: threadType!,
                topicId: normalizedTopicId!,
              })
            : [];
        setThreadMessages(nextMessages);
      } catch {
        toast.show('error', t.threadLoadFailed);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      activeThreadId,
      isDraftThread,
      isGroupSession,
      normalizedSourceMessageId,
      normalizedTopicId,
      sessionId,
      t.threadLoadFailed,
      threadType,
      toast,
      setThreadMessages,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      void loadMessages(true);
      if (!title?.trim() && activeThreadId) {
        void refreshThreadTitle();
      }
    }, [activeThreadId, loadMessages, refreshThreadTitle, title]),
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
    setThreadMessages((prev) => [...prev, optimisticUser, optimisticAssistant]);

    const createBaseParams = isGroupSession ? { groupId: sessionId } : { sessionId };
    const contextMessages = [...messagesRef.current, optimisticUser]
      .map(buildContextMessage)
      .filter(
        (message): message is NonNullable<ReturnType<typeof buildContextMessage>> => !!message,
      );

    let userMessageId: string | undefined;
    let nextThreadId = activeThreadId;
    let shouldReloadThread = false;
    let pendingAssistantDraft: ChatMessage | null = null;
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const flushPendingAssistant = () => {
      throttleTimer = null;
      const nextAssistant = pendingAssistantDraft;
      pendingAssistantDraft = null;

      if (!nextAssistant) return;

      updateThreadMessage(assistantTempId, () => nextAssistant);
    };

    const flushPendingAssistantNow = () => {
      if (throttleTimer) {
        clearTimeout(throttleTimer);
        throttleTimer = null;
      }

      flushPendingAssistant();
    };

    const scheduleAssistantUpdate = (updater: (message: ChatMessage) => ChatMessage) => {
      const currentAssistant =
        pendingAssistantDraft ?? getThreadMessageById(messagesRef.current, assistantTempId);

      if (!currentAssistant) return;

      pendingAssistantDraft = updater(currentAssistant);

      if (!throttleTimer) {
        throttleTimer = setTimeout(flushPendingAssistant, THREAD_STREAM_THROTTLE_MS);
      }
    };

    try {
      if (nextThreadId) {
        const createdUser = await messageApi.create({
          ...createBaseParams,
          content: text,
          role: 'user',
          threadId: nextThreadId,
          topicId: normalizedTopicId,
        });
        userMessageId = createdUser.id;
      } else if (isDraftThread) {
        const createdThread = await threadApi.createWithMessage({
          ...(screenTitle.trim() ? { title: screenTitle.trim() } : {}),
          message: {
            ...createBaseParams,
            content: text,
            role: 'user',
            topicId: normalizedTopicId,
          },
          sourceMessageId: normalizedSourceMessageId,
          topicId: normalizedTopicId!,
          type: threadType!,
        });

        if (!createdThread.threadId?.trim() || !createdThread.messageId?.trim()) {
          throw new Error(t.threadCreateFailed);
        }

        nextThreadId = createdThread.threadId.trim();
        userMessageId = createdThread.messageId.trim();
        setCurrentThreadId(nextThreadId);
        shouldReloadThread = true;
      } else {
        throw new Error(t.threadCreateFailed);
      }

      const chatOptions = await getSessionChatOptions(sessionId);
      const provider =
        chatOptions.provider || resolveProviderByModel(chatOptions.model) || 'openai';

      updateThreadMessage(assistantTempId, (message) => ({
        ...message,
        model: chatOptions.model,
        provider,
      }));

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
            scheduleAssistantUpdate((message) => {
              const nextMetadata = mergeMessageMetadata(message.metadata, contentState);

              return {
                ...message,
                content: contentState.content,
                ...(nextMetadata ? { metadata: nextMetadata } : {}),
                updatedAt: new Date().toISOString(),
              };
            });
          },
          onImages: (images) => {
            scheduleAssistantUpdate((message) => ({
              ...message,
              imageList: images,
              updatedAt: new Date().toISOString(),
            }));
          },
          onPerformance: (performance) => {
            scheduleAssistantUpdate((message) => ({
              ...message,
              performance: performance as any,
              updatedAt: new Date().toISOString(),
            }));
          },
          onReasoning: (reasoningState: StreamReasoningState) => {
            scheduleAssistantUpdate((message) => ({
              ...message,
              reasoning: buildReasoningState(reasoningState),
              updatedAt: new Date().toISOString(),
            }));
          },
          onSearch: (search) => {
            scheduleAssistantUpdate((message) => ({
              ...message,
              search,
              updatedAt: new Date().toISOString(),
            }));
          },
          onToolExecutions: (executions) => {
            scheduleAssistantUpdate((message) => {
              const resolvedTools = mergeResolvedToolPayloads(
                message.tools ?? undefined,
                executions,
              );

              return resolvedTools
                ? { ...message, tools: resolvedTools, updatedAt: new Date().toISOString() }
                : message;
            });
          },
          onTools: (tools) => {
            scheduleAssistantUpdate((message) => ({
              ...message,
              tools,
              updatedAt: new Date().toISOString(),
            }));
          },
          onUsage: (usage) => {
            scheduleAssistantUpdate((message) => ({
              ...message,
              updatedAt: new Date().toISOString(),
              usage: usage as any,
            }));
          },
        },
      );

      flushPendingAssistantNow();
      const localAssistant = getThreadMessageById(messagesRef.current, assistantTempId);
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
          threadId: nextThreadId,
          topicId: normalizedTopicId,
        });
        shouldReloadThread = true;
      } catch (error) {
        console.warn('[ThreadDetailScreen] Failed to persist assistant message:', error);
      }

      if (nextThreadId && (!title?.trim() || !activeThreadId)) {
        void refreshThreadTitle(nextThreadId);
      }
    } catch (error) {
      if (userMessageId) shouldReloadThread = true;

      const errorMessage =
        error instanceof Error && error.message.trim()
          ? error.message
          : activeThreadId || isDraftThread
            ? t.threadSendFailed
            : t.threadCreateFailed;
      toast.show('error', errorMessage);

      if (!userMessageId) {
        setThreadMessages((prev) =>
          prev.filter((message) => message.id !== userTempId && message.id !== assistantTempId),
        );
        setInputText(text);
      }
    } finally {
      flushPendingAssistantNow();
      if (shouldReloadThread) {
        await loadMessages(false, nextThreadId);
      }
      setPendingAssistantId(null);
      setSending(false);
    }
  }, [
    activeThreadId,
    inputText,
    isDraftThread,
    isGroupSession,
    loadMessages,
    normalizedSourceMessageId,
    normalizedTopicId,
    refreshThreadTitle,
    screenTitle,
    sending,
    sessionId,
    setThreadMessages,
    t.threadCreateFailed,
    t.threadSendFailed,
    title,
    toast,
    topicId,
    threadType,
    updateThreadMessage,
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

  const applyThreadToolExecutions = useCallback(
    (assistantMessageId: string, executions: ToolExecutionItem[], tools?: ChatToolPayload[]) => {
      const baseTools =
        tools ?? getThreadMessageById(messagesRef.current, assistantMessageId)?.tools;
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
      subtitle={activeThreadId}
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
