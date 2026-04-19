/**
 * ChatDetailScreen — Full chat experience with MessageBubble, Topics, and file attachments.
 */
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { ArrowDown } from 'lucide-react-native';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Keyboard,
  LayoutAnimation,
  Platform,
  RefreshControl,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';

import ChatDetailHeader from '../components/ChatDetailHeader';
import AttachmentSheet from '../components/ui/AttachmentSheet';
import { ChatComposerBody } from '../components/ui/ChatComposerBody';
import EmptyState from '../components/ui/EmptyState';
import FilePreview from '../components/ui/FilePreview';
import MemoryToolSheet from '../components/ui/MemoryToolSheet';
import MessageBubble, { type GroupMessageSpeaker } from '../components/ui/MessageBubble';
import MessageListSkeleton from '../components/ui/MessageListSkeleton';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import PressableScale from '../components/ui/PressableScale';
import ResourcePickerSheet from '../components/ui/ResourcePickerSheet';
import SkillsSheet from '../components/ui/SkillsSheet';
import { useToast } from '../components/ui/Toast';
import { withAlpha } from '../constants/tags';
import { useChatDetailAttachments } from '../hooks/useChatDetailAttachments';
import { useChatDetailComposerControls } from '../hooks/useChatDetailComposerControls';
import { useChatDetailSkills } from '../hooks/useChatDetailSkills';
import { agentGroupApi, type AgentGroupDetail, messageApi, topicApi } from '../lib/api';
import { stackScreenComposerPaddingBottom } from '../lib/bottomChrome';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { createComposerKeyboardSubscriptions, resolveComposerLift } from '../lib/keyboard';
import { appendCurrentPortalStack } from '../lib/portalNavigation';
import { isGroupSessionLike } from '../lib/session';
import type { RootStackScreenProps } from '../navigation/types';
import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { buildDisplayMessages } from '../store/messageDisplay';
import { useModelStore } from '../store/model';
import { useSessionStore } from '../store/session';
import { useThemeStore } from '../store/theme';
import { EMPTY_TOPICS, useTopicStore } from '../store/topic';
import { useThemeColors } from '../theme/colors';
import type { ChatContextSelection, ChatMessage, FileAttachment } from '../types';

const EMPTY_CHAT_CONTEXT_SELECTIONS: ChatContextSelection[] = [];
const EMPTY_PENDING_FILES: FileAttachment[] = [];
const EMPTY_MESSAGES: ChatMessage[] = [];
const MESSAGE_ESTIMATE_SAMPLE_SIZE = 12;
const AUTO_SCROLL_LOCK_OFFSET = 24;
const SCROLL_TO_LATEST_OFFSET = 200;
const SCROLL_TO_LATEST_BOTTOM_THRESHOLD = 100;
const extractPersistedMessageIds = (messages: ChatMessage[]) =>
  messages
    .map((message) => message.id)
    .filter(
      (id) =>
        !id.startsWith('assistant-') &&
        !id.startsWith('local-') &&
        !id.startsWith('tmp_') &&
        !id.startsWith('user-'),
    );

const getEstimatedMessageHeight = (message: ChatMessage) => {
  let estimate = 96;
  const textLength = message.content.trim().length;

  if (textLength > 0) {
    estimate += Math.min(144, Math.ceil(textLength / 42) * 18);
  }

  if (message.reasoning?.content) {
    estimate += Math.min(72, Math.ceil(message.reasoning.content.length / 88) * 14);
  }

  if (message.imageList?.length) {
    estimate += Math.min(message.imageList.length, 3) * 78;
  }

  if (message.fileList?.length) {
    estimate += Math.min(message.fileList.length, 3) * 44;
  }

  if (message.tools?.length) {
    estimate += Math.min(message.tools.length, 4) * 36;
  }

  if (message.children?.length) {
    estimate += Math.min(message.children.length, 4) * 48;
  }

  if (message.tasks?.length) {
    estimate += Math.min(message.tasks.length, 4) * 36;
  }

  return Math.min(Math.max(estimate, 96), 280);
};

const getEstimatedMessageItemSize = (messages: ChatMessage[]) => {
  if (messages.length === 0) return 132;

  const sample = messages.slice(-MESSAGE_ESTIMATE_SAMPLE_SIZE);
  const total = sample.reduce((sum, message) => sum + getEstimatedMessageHeight(message), 0);

  return Math.round(total / sample.length);
};

export default function ChatDetailScreen({
  route,
  navigation,
}: RootStackScreenProps<'ChatDetail'>) {
  const sessionId = route.params?.sessionId as string | undefined;
  const sessionKey = sessionId ?? '__invalid_session__';
  const initialTopicId = route.params?.topicId ?? null;
  const focusMessageId = route.params?.messageId;
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);

  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const isGroupSession = isGroupSessionLike(sessionId, session?.type);
  const [pendingRouteTopicId, setPendingRouteTopicId] = useState<string | null>(initialTopicId);

  const rawMessages = useChatStore((s) => s.messagesBySession[sessionKey] ?? EMPTY_MESSAGES);
  const routeTopicTransitioning = pendingRouteTopicId != null;
  const visibleRawMessages =
    routeTopicTransitioning && rawMessages.length === 0 ? EMPTY_MESSAGES : rawMessages;
  const messages = useMemo(
    () => buildDisplayMessages(visibleRawMessages, isGroupSession),
    [visibleRawMessages, isGroupSession],
  );
  const fetchingMessages = useChatStore((s) => s.fetchingMessagesBySession[sessionKey] ?? false);
  const generating = useChatStore((s) => s.generating && s.activeStreamingSessionId === sessionKey);
  const activeStreamingMessageId = useChatStore((s) =>
    s.activeStreamingSessionId === sessionKey ? s.activeStreamingMessageId : null,
  );
  const activeOperationId = useChatStore((s) => s.activeOperationId);
  const activeStreamingSessionId = useChatStore((s) => s.activeStreamingSessionId);
  const isReasoning = useChatStore((s) => s.isReasoning);
  const generatingStartedAt = useChatStore((s) => s.generatingStartedAt);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGenerating = useChatStore((s) => s.stopGenerating);
  const fetchMessages = useChatStore((s) => s.fetchMessages);

  const activeTopic = useTopicStore((s) => s.activeTopicBySession[sessionKey] ?? null);
  const topics = useTopicStore((s) => s.topicsBySession[sessionKey] ?? EMPTY_TOPICS);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);
  const switchTopic = useTopicStore((s) => s.switchTopic);
  const activeTopicItem = useMemo(
    () => topics.find((topic) => topic.id === activeTopic) ?? null,
    [activeTopic, topics],
  );

  const { chatContextSelectionCount, pendingFilesCount } = useFileStore(
    useShallow((s) => ({
      chatContextSelectionCount: sessionId
        ? (s.sessionChatContextSelections[sessionId]?.length ?? 0)
        : 0,
      pendingFilesCount: sessionId ? (s.sessionPendingFiles[sessionId]?.length ?? 0) : 0,
    })),
  );
  const addFile = useFileStore((s) => s.addFile);
  const addSessionChatContextSelection = useFileStore((s) => s.addSessionChatContextSelection);

  const [inputText, setInputText] = useState('');
  const listRef = useRef<FlashList<ChatMessage>>(null);
  const isScrolledToBottom = useRef(true);
  const autoScrollLocked = useRef(false);
  const lastAutoScrollAt = useRef(0);
  const hasObservedTopicChange = useRef(false);
  /** Tracks generating across renders so we only refetch when a stream ends, not on every deps churn */
  const prevGenForMessageSyncRef = useRef<boolean | null>(null);
  const prevTopicForMessageSyncRef = useRef<string | null | undefined>(undefined);
  const rawMessagesRef = useRef(rawMessages);
  const activeTopicRef = useRef(activeTopic);
  const sessionTypeRef = useRef(session?.type);
  const showScrollToTopRef = useRef(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const animatedKeyboard = useAnimatedKeyboard();
  const [listRefreshing, setListRefreshing] = useState(false);
  const [groupDetail, setGroupDetail] = useState<AgentGroupDetail | null>(null);

  const sessionModel = useModelStore((s) => s.selectedModel);
  const sessionProvider = useModelStore((s) => s.selectedProvider);
  const modelProviders = useModelStore((s) => s.providers);
  const fetchModels = useModelStore((s) => s.fetchModels);
  const loadSelection = useModelStore((s) => s.loadSelection);
  const modelSupportsVision = useMemo(() => {
    if (!sessionModel || modelProviders.length === 0) return true;
    for (const p of modelProviders) {
      const m = p.children.find((c) => c.id === sessionModel);
      if (m) return !!m.abilities?.vision;
    }
    return true;
  }, [sessionModel, modelProviders]);

  const sessionSearchMode = session?.chatConfig?.searchMode;
  const sessionMemoryEnabled = session?.chatConfig?.memory?.enabled;
  const sessionMemoryEffort = session?.chatConfig?.memory?.effort;

  useEffect(() => {
    if (!sessionId) return;
    fetchModels();
    loadSelection(sessionId);
  }, [fetchModels, loadSelection, sessionId]);

  const {
    agentSkillItems,
    builtinSkillItems,
    closeSkillsSheet,
    enabledPlugins,
    installedPlugins,
    loadingSkills,
    openSkillsSheet,
    skillsSheetVisible,
    togglePlugin,
  } = useChatDetailSkills({
    isGroupSession,
    sessionId,
  });

  const {
    attachmentSheetVisible,
    closeAttachmentSheet,
    closeResourcePicker,
    conversationFiles,
    handleRemoveConversationFile,
    handleWorkspaceSelect,
    openAttachmentSheet,
    openResourcePicker,
    pickDocument,
    pickImage,
    resourcePickerVisible,
  } = useChatDetailAttachments({
    sessionId,
  });

  const {
    clearProviderLogoError,
    closeMemorySheet,
    closeModelDrawer,
    handleToggleSearch,
    markProviderLogoError,
    memoryEffort,
    memoryEnabled,
    memorySheetVisible,
    modelDrawerVisible,
    openMemorySheet,
    openModelDrawer,
    providerLogoError,
    searchEnabled,
    toolbarProviderLogo,
    updateMemoryConfig,
  } = useChatDetailComposerControls({
    effectiveTheme,
    isGroupSession,
    modelProviders,
    sessionId,
    sessionMemoryEffort,
    sessionMemoryEnabled,
    sessionProvider,
    sessionSearchMode,
  });

  useEffect(() => {
    hasObservedTopicChange.current = false;
    prevGenForMessageSyncRef.current = null;
    prevTopicForMessageSyncRef.current = undefined;
  }, [sessionId]);

  useEffect(() => {
    isScrolledToBottom.current = true;
    autoScrollLocked.current = false;
    lastAutoScrollAt.current = 0;
    showScrollToTopRef.current = false;
    setShowScrollToTop(false);
  }, [activeTopic, sessionId]);

  // Sync route topicId to store immediately (useLayoutEffect so it runs before useFocusEffect)
  useLayoutEffect(() => {
    if (!sessionId) return;
    if (initialTopicId != null) {
      switchTopic(sessionId, initialTopicId);
    }
  }, [initialTopicId, sessionId, switchTopic]);

  useEffect(() => {
    if (!sessionId || initialTopicId == null) {
      setPendingRouteTopicId(null);
      return;
    }

    let disposed = false;
    setPendingRouteTopicId(initialTopicId);

    void fetchMessages(sessionId, initialTopicId).finally(() => {
      if (disposed) return;
      setPendingRouteTopicId((current) => (current === initialTopicId ? null : current));
    });

    return () => {
      disposed = true;
    };
  }, [fetchMessages, initialTopicId, sessionId]);

  useEffect(() => {
    if (!sessionId || session) return;
    void fetchSessions();
  }, [fetchSessions, session, sessionId]);

  const loadGroupDetail = useCallback(async () => {
    if (!sessionId || !isGroupSession) {
      setGroupDetail(null);
      return;
    }

    try {
      const detail = await agentGroupApi.getGroupDetail(sessionId);
      setGroupDetail(detail);
    } catch {
      setGroupDetail(null);
    }
  }, [isGroupSession, sessionId]);

  const stopActiveGroupOperation = useCallback(
    (reason: string) => {
      if (!sessionId) return;

      const shouldStop =
        generating &&
        activeStreamingSessionId === sessionId &&
        typeof activeOperationId === 'string';

      if (!shouldStop) return;

      console.warn(`[ChatDetail] stopping active group operation on ${reason}`);
      stopGenerating();
    },
    [activeOperationId, activeStreamingSessionId, generating, sessionId, stopGenerating],
  );

  useEffect(() => {
    void loadGroupDetail();
  }, [loadGroupDetail]);

  useFocusEffect(
    useCallback(() => {
      void loadGroupDetail();
    }, [loadGroupDetail]),
  );

  // Refresh messages/topics only when the screen actually gains focus (align with Web revalidateOnFocus).
  // Read chat/topic state via getState() so we do NOT re-run this when generating/activeTopic/etc. change while focused —
  // that was causing repeated full refetches during tool rounds and stream end.
  useFocusEffect(
    useCallback(() => {
      if (!sessionId) return;

      const chat = useChatStore.getState();
      if (chat.generating && chat.activeStreamingSessionId === sessionId) return;

      const topicState = useTopicStore.getState();
      const activeTopicNow = topicState.activeTopicBySession[sessionId] ?? null;
      const topicId = initialTopicId ?? activeTopicNow ?? undefined;

      void useSessionStore.getState().fetchSessions();
      void chat.fetchMessages(sessionId, topicId, { preferPopulatedTopic: true });
      void topicState.fetchTopics(sessionId).then(() => {
        if (initialTopicId != null) {
          useTopicStore.getState().switchTopic(sessionId, initialTopicId);
        }
      });
    }, [sessionId, initialTopicId]),
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopActiveGroupOperation('blur');
      };
    }, [stopActiveGroupOperation]),
  );

  const inputPaddingBottom = stackScreenComposerPaddingBottom(insets.bottom);
  const composerLiftStyle = useAnimatedStyle(() => {
    const lift = resolveComposerLift({
      animatedKeyboardHeight: animatedKeyboard.height.value,
      bottomInset: insets.bottom,
      keyboardOffset,
      platform: Platform.OS,
    });

    return {
      transform: [{ translateY: -lift }],
    };
  }, [insets.bottom, keyboardOffset]);

  useEffect(() => {
    const subscriptions = createComposerKeyboardSubscriptions({
      bottomInset: insets.bottom,
      onKeyboardOffsetChange: setKeyboardOffset,
      platform: Platform.OS,
    });

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [insets.bottom]);

  // Rotating placeholder hints
  const hints = useMemo(
    () => [t.chatAskAnything, t.chatHint1, t.chatHint2, t.chatHint3, t.chatHint4],
    [t],
  );
  const [hintIndex, setHintIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setHintIndex((i) => (i + 1) % hints.length), 4000);
    return () => clearInterval(timer);
  }, [hints.length]);

  // Refetch when the user switches topic or when a generation stream ends — not on unrelated dep churn.
  useEffect(() => {
    if (!sessionId) return;

    if (prevGenForMessageSyncRef.current === null) {
      prevGenForMessageSyncRef.current = generating;
      if (!hasObservedTopicChange.current) {
        hasObservedTopicChange.current = true;
        prevTopicForMessageSyncRef.current = activeTopic;
      }
      return;
    }

    const genWas = prevGenForMessageSyncRef.current;
    prevGenForMessageSyncRef.current = generating;

    if (generating) {
      return;
    }

    if (!hasObservedTopicChange.current) {
      hasObservedTopicChange.current = true;
      prevTopicForMessageSyncRef.current = activeTopic;
      return;
    }

    const streamJustEnded = genWas && !generating;
    const topicChanged = prevTopicForMessageSyncRef.current !== activeTopic;
    if (streamJustEnded || topicChanged) {
      prevTopicForMessageSyncRef.current = activeTopic;
      void fetchMessages(sessionId, activeTopic ?? undefined, {
        preserveOnEmpty: streamJustEnded,
      });
    }
  }, [sessionId, generating, activeTopic, fetchMessages]);

  useEffect(() => {
    if (sessionId) return;
    toast.show('error', t.errorUnknown);
    navigation.goBack();
  }, [navigation, sessionId, t.errorUnknown, toast]);

  useEffect(() => {
    if (!sessionId) return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        stopActiveGroupOperation(`appstate:${nextState}`);
        return;
      }
      if (generating && activeStreamingSessionId === sessionId) {
        return;
      }

      const topicId = activeTopic ?? undefined;
      void Promise.allSettled([
        fetchSessions(),
        fetchTopics(sessionId),
        fetchMessages(sessionId, topicId, { preferPopulatedTopic: true, preserveOnEmpty: true }),
      ]);
    });

    return () => {
      subscription.remove();
    };
  }, [
    activeStreamingSessionId,
    activeTopic,
    fetchMessages,
    fetchSessions,
    fetchTopics,
    generating,
    sessionId,
    stopActiveGroupOperation,
  ]);

  useEffect(() => {
    if (!generating) return;
    const WATCHDOG_MS = 180_000;
    const elapsed = generatingStartedAt ? Date.now() - generatingStartedAt : 0;
    const remaining = Math.max(WATCHDOG_MS - elapsed, 0);
    const timer = setTimeout(() => {
      if (generating) {
        console.warn('[ChatDetail] generating watchdog triggered, force-stopping');
        stopGenerating();
      }
    }, remaining);
    return () => clearTimeout(timer);
  }, [generating, generatingStartedAt, stopGenerating]);

  useEffect(() => {
    if (!focusMessageId || messages.length === 0) return;

    const messageIndex = messages.findIndex((message) => message.id === focusMessageId);
    if (messageIndex < 0 || messageIndex >= messages.length) return;

    requestAnimationFrame(() => {
      try {
        listRef.current?.scrollToIndex({
          animated: true,
          index: messageIndex,
          viewPosition: 0.5,
        });
      } catch {
        /* best-effort */
      }
    });
  }, [focusMessageId, messages]);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const groupMembersById = useMemo<Record<string, GroupMessageSpeaker> | undefined>(() => {
    if (!groupDetail?.agents?.length) return undefined;

    return Object.fromEntries(
      groupDetail.agents.map((agent) => [
        agent.id,
        {
          avatar: agent.avatar,
          id: agent.id,
          isSupervisor: agent.isSupervisor || groupDetail.supervisorAgentId === agent.id,
          title: agent.title,
        },
      ]),
    );
  }, [groupDetail]);

  const groupOpeningMessage = useMemo(() => {
    const value = groupDetail?.config?.openingMessage;
    return typeof value === 'string' ? value.trim() : '';
  }, [groupDetail?.config]);

  const groupOpeningQuestions = useMemo(() => {
    const value = groupDetail?.config?.openingQuestions;
    if (!Array.isArray(value)) return [];

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 4);
  }, [groupDetail?.config]);

  const emptyStateTitle = isGroupSession
    ? session?.title || t.groupCreateDefaultTitle
    : t.chatEmptyWave;
  const emptyStateDescription =
    isGroupSession && groupOpeningMessage ? groupOpeningMessage : t.chatEmptyDesc;
  const emptyStateSuggestions =
    isGroupSession && groupOpeningQuestions.length > 0
      ? groupOpeningQuestions
      : [t.chatSuggest1, t.chatSuggest2, t.chatSuggest3, t.chatSuggest4];

  useEffect(() => {
    rawMessagesRef.current = rawMessages;
  }, [rawMessages]);

  useEffect(() => {
    activeTopicRef.current = activeTopic;
  }, [activeTopic]);

  useEffect(() => {
    sessionTypeRef.current = session?.type;
  }, [session?.type]);

  const sendScale = useSharedValue(1);
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));
  const composerAttachmentCount = pendingFilesCount + chatContextSelectionCount;
  const composerPreviewCount = composerAttachmentCount + conversationFiles.length;
  const composerPreviewVisible = composerPreviewCount > 0;
  const composerActive =
    keyboardOffset > 0 || Boolean(inputText.trim()) || composerPreviewCount > 0 || generating;

  const autoScrollToEnd = useCallback(() => {
    if (!listRef.current || messages.length === 0) return;
    if (autoScrollLocked.current || !isScrolledToBottom.current) return;

    const now = Date.now();
    const minInterval = generating ? 140 : 0;
    const delta = now - lastAutoScrollAt.current;
    if (delta < minInterval) return;

    lastAutoScrollAt.current = now;
    requestAnimationFrame(() => {
      try {
        const animated = !generating || delta > 260;
        listRef.current?.scrollToEnd({ animated });
      } catch {
        /* best-effort */
      }
    });
  }, [generating, messages.length]);

  const handleStop = useCallback(() => {
    haptics.light();
    stopGenerating();
    toast.show('info', t.toastGenerationStopped);
  }, [stopGenerating, toast, t.toastGenerationStopped]);

  const handleSend = useCallback(async () => {
    if (!sessionId || (!inputText.trim() && composerAttachmentCount === 0) || generating) return;

    const chatContextSelections =
      useFileStore.getState().sessionChatContextSelections[sessionId] ??
      EMPTY_CHAT_CONTEXT_SELECTIONS;
    const pendingFiles =
      useFileStore.getState().sessionPendingFiles[sessionId] ?? EMPTY_PENDING_FILES;

    haptics.light();
    autoScrollLocked.current = false;
    isScrolledToBottom.current = true;
    sendScale.value = withSequence(withSpring(0.8, { damping: 8 }), withSpring(1, { damping: 6 }));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const textToSend = inputText.trim();
    setInputText('');
    Keyboard.dismiss();
    const success = await sendMessage(sessionId, textToSend, activeTopic ?? undefined, {
      chatContextSelections,
      memoryEffort,
      memoryEnabled,
      pendingFileSessionId: sessionId,
      pendingFiles,
      preserveChatContextSelections: true,
      plugins: enabledPlugins.size > 0 ? [...enabledPlugins] : undefined,
      searchEnabled,
    });
    if (!success) {
      setInputText(textToSend);
    }
  }, [
    inputText,
    generating,
    sendMessage,
    sessionId,
    enabledPlugins,
    activeTopic,
    composerAttachmentCount,
    memoryEffort,
    memoryEnabled,
    searchEnabled,
    sendScale,
  ]);

  // ── Toolbar: Clear messages ───────────────────────────────────────
  const handleClear = useCallback(() => {
    if (!sessionId || messages.length === 0) return;
    haptics.warning();
    Alert.alert(t.chatClearTitle, t.chatClearMessage, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.chatClearConfirm,
        style: 'destructive',
        onPress: async () => {
          try {
            const ids = messages.map((m) => m.id);
            await messageApi.removeAll(ids);
            fetchMessages(sessionId, activeTopic ?? undefined);
          } catch {
            /* ignore */
          }
        },
      },
    ]);
  }, [messages, t, sessionId, activeTopic, fetchMessages]);

  const handleSaveToTopic = useCallback(async () => {
    if (!sessionId) return;
    if (activeTopicRef.current) {
      return;
    }
    try {
      const messageIds = extractPersistedMessageIds(rawMessagesRef.current);
      const topicId = await topicApi.create(sessionId, t.topicTitle, {
        ...(messageIds.length > 0 ? { messageIds } : {}),
        sessionType: sessionTypeRef.current ?? 'agent',
      });
      if (topicId) {
        haptics.success();
        switchTopic(sessionId, topicId);
        void Promise.allSettled([fetchTopics(sessionId), fetchMessages(sessionId, topicId)]);
      }
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [sessionId, t, toast, fetchMessages, fetchTopics, switchTopic]);

  const handleOpenNotebook = useCallback(async () => {
    if (!sessionId) return;

    haptics.light();

    try {
      const currentTopicId = activeTopic ?? initialTopicId;
      const messageIds = extractPersistedMessageIds(rawMessages);

      if (currentTopicId) {
        navigation.navigate('Notebook', { sessionId, topicId: currentTopicId });
        return;
      }

      const topicId = await topicApi.create(sessionId, t.topicTitle, {
        ...(messageIds.length > 0 ? { messageIds } : {}),
        sessionType: session?.type ?? 'agent',
      });

      if (!topicId) return;

      switchTopic(sessionId, topicId);
      void fetchTopics(sessionId);
      navigation.navigate('Notebook', { sessionId, topicId });
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [
    activeTopic,
    fetchTopics,
    initialTopicId,
    navigation,
    rawMessages,
    session?.type,
    sessionId,
    switchTopic,
    t.errorNetwork,
    t.topicTitle,
    toast,
  ]);

  const handleOpenThreads = useCallback(() => {
    if (!sessionId) return;

    const topicId = activeTopic ?? initialTopicId;
    if (!topicId) return;

    haptics.light();
    navigation.navigate(
      'ThreadList',
      appendCurrentPortalStack(route.name, route.params, { sessionId, topicId }),
    );
  }, [activeTopic, initialTopicId, navigation, route.name, route.params, sessionId]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => {
      const isStreamingMessage = item.id === activeStreamingMessageId;

      return (
        <MessageBubble
          generating={generating && isStreamingMessage}
          groupMembersById={groupMembersById}
          groupSupervisorId={groupDetail?.supervisorAgentId}
          isGroupSession={isGroupSession}
          isReasoning={isReasoning && isStreamingMessage}
          message={item}
          sessionId={sessionId || sessionKey}
          topicId={activeTopic ?? null}
          onSaveToTopic={activeTopic ? undefined : handleSaveToTopic}
        />
      );
    },
    [
      activeTopic,
      activeStreamingMessageId,
      generating,
      groupDetail?.supervisorAgentId,
      groupMembersById,
      handleSaveToTopic,
      isGroupSession,
      isReasoning,
      sessionId,
      sessionKey,
    ],
  );
  const estimatedItemSize = useMemo(() => getEstimatedMessageItemSize(messages), [messages]);

  const onListRefresh = useCallback(async () => {
    if (!sessionId) return;
    if (generating && activeStreamingSessionId === sessionId) return;
    setListRefreshing(true);
    try {
      const topicId = initialTopicId ?? activeTopic ?? undefined;
      await Promise.all([
        fetchSessions(),
        fetchTopics(sessionId),
        fetchMessages(sessionId, topicId, { preferPopulatedTopic: true }),
      ]);
      void loadGroupDetail();
    } finally {
      setListRefreshing(false);
    }
  }, [
    activeStreamingSessionId,
    activeTopic,
    fetchMessages,
    fetchSessions,
    fetchTopics,
    generating,
    initialTopicId,
    loadGroupDetail,
    sessionId,
  ]);

  const handleListScroll = useCallback(
    (contentOffsetY: number, contentHeight: number, layoutHeight: number) => {
      const atBottom =
        layoutHeight + contentOffsetY >= contentHeight - SCROLL_TO_LATEST_BOTTOM_THRESHOLD;
      isScrolledToBottom.current = atBottom;
      autoScrollLocked.current = !atBottom && contentOffsetY > AUTO_SCROLL_LOCK_OFFSET;

      const nextShowScrollToTop = !atBottom && contentOffsetY > SCROLL_TO_LATEST_OFFSET;
      if (nextShowScrollToTop === showScrollToTopRef.current) return;

      showScrollToTopRef.current = nextShowScrollToTop;
      setShowScrollToTop(nextShowScrollToTop);
    },
    [],
  );

  if (!sessionId) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      {/* Header - Using unified ChatDetailHeader component */}
      <ChatDetailHeader
        activeTopic={activeTopic}
        activeTopicTitle={activeTopicItem?.title}
        generating={generating}
        isGroupSession={isGroupSession}
        isReasoning={isReasoning}
        navigation={navigation}
        sessionId={sessionId}
        sessionModel={sessionModel}
        sessionTitle={session?.title}
        toolbarProviderLogo={toolbarProviderLogo}
        onOpenNotebook={handleOpenNotebook}
        onOpenThreads={(activeTopic ?? initialTopicId) ? handleOpenThreads : undefined}
      />

      {/* Message List + Input */}
      <View className="flex-1">
        {fetchingMessages && messages.length === 0 ? (
          <MessageListSkeleton />
        ) : (
          <FlashList
            accessibilityLiveRegion="polite"
            contentContainerStyle={{ paddingBottom: 12, paddingTop: 12 }}
            data={messages}
            estimatedItemSize={estimatedItemSize}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ref={listRef}
            renderItem={renderMessage}
            scrollEventThrottle={16}
            ListEmptyComponent={
              <View
                style={{
                  justifyContent: 'center',
                  minHeight: windowHeight * 0.5,
                }}
              >
                <EmptyState
                  description={emptyStateDescription}
                  iconVariant="chat"
                  title={emptyStateTitle}
                  action={
                    <Animated.View
                      className="flex-row flex-wrap justify-center gap-2 mt-4 px-6"
                      entering={FadeInDown.delay(200).duration(350)}
                    >
                      {emptyStateSuggestions.map((label) => (
                        <TouchableOpacity
                          accessibilityLabel={label}
                          accessibilityRole="button"
                          activeOpacity={0.7}
                          className="rounded-full px-4 py-2.5"
                          key={label}
                          style={{
                            backgroundColor: withAlpha(colors.primary, '14'),
                            borderColor: withAlpha(colors.primary, '24'),
                            borderWidth: 1,
                          }}
                          onPress={() => {
                            haptics.light();
                            setInputText(label);
                          }}
                        >
                          <Text
                            className="text-[13px] font-medium"
                            style={{ color: colors.secondaryText }}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </Animated.View>
                  }
                />
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={listRefreshing}
                tintColor={colors.primary}
                onRefresh={() => void onListRefresh()}
              />
            }
            onContentSizeChange={autoScrollToEnd}
            onLayout={autoScrollToEnd}
            onScroll={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              handleListScroll(contentOffset.y, contentSize.height, layoutMeasurement.height);
            }}
          />
        )}

        {/* Jump to latest FAB */}
        {showScrollToTop && (
          <Animated.View
            className="absolute right-4 bottom-24"
            entering={FadeInUp.duration(200)}
            exiting={FadeOut.duration(150)}
          >
            <PressableScale
              accessibilityLabel={t.chatJumpToLatest}
              className="w-10 h-10 rounded-full bg-foreground/90 items-center justify-center shadow-lg"
              onPress={() => {
                haptics.light();
                autoScrollLocked.current = false;
                isScrolledToBottom.current = true;
                listRef.current?.scrollToEnd({ animated: true });
              }}
            >
              <ArrowDown color={colors.iconOnPrimary} size={18} strokeWidth={2.5} />
            </PressableScale>
          </Animated.View>
        )}

        {/* Input Area — Floating Pill. Move by keyboard height for stable cross-platform lift. */}
        <Animated.View
          style={[
            {
              paddingBottom: inputPaddingBottom,
              paddingHorizontal: 16,
              paddingTop: 4,
            },
            composerLiftStyle,
          ]}
        >
          <ChatComposerBody
            textEditable
            active={composerActive}
            canSend={Boolean(inputText.trim()) || composerAttachmentCount > 0}
            generating={generating}
            memoryEnabled={memoryEnabled}
            modelDrawerVisible={modelDrawerVisible}
            pendingFilesCount={composerPreviewCount}
            placeholder={generating ? t.chatGenerating : hints[hintIndex]}
            pluginsEnabled={enabledPlugins.size > 0}
            providerLogoError={providerLogoError}
            searchEnabled={searchEnabled}
            sendAnimStyle={sendAnimStyle}
            toolbarProviderLogo={toolbarProviderLogo}
            value={inputText}
            variant={isGroupSession ? 'detailGroup' : 'detailPersonal'}
            groupMembers={
              isGroupSession && groupDetail?.agents?.length
                ? groupDetail.agents.map((a) => ({
                    avatar: a.avatar,
                    id: a.id,
                    title: a.title,
                  }))
                : undefined
            }
            topSlot={
              composerPreviewVisible ? (
                <View className="px-3 pt-2">
                  <FilePreview
                    conversationFiles={conversationFiles}
                    sessionId={sessionId}
                    topicId={activeTopic ?? initialTopicId ?? undefined}
                    onRemoveConversationFile={handleRemoveConversationFile}
                  />
                </View>
              ) : undefined
            }
            onAttach={openAttachmentSheet}
            onChangeText={setInputText}
            onClear={handleClear}
            onMemoryPress={openMemorySheet}
            onModelPress={openModelDrawer}
            onPluginsPress={openSkillsSheet}
            onProviderLogoError={markProviderLogoError}
            onSend={handleSend}
            onStop={handleStop}
            onToggleSearch={handleToggleSearch}
          />
        </Animated.View>
      </View>

      <ModelDrawer
        sessionId={sessionId}
        visible={modelDrawerVisible && !isGroupSession}
        onClose={closeModelDrawer}
        onSelect={clearProviderLogoError}
      />
      <AttachmentSheet
        visible={attachmentSheetVisible}
        onCamera={modelSupportsVision ? () => void pickImage('camera') : undefined}
        onClose={closeAttachmentSheet}
        onDocument={() => void pickDocument()}
        onFromWorkspace={openResourcePicker}
        onGallery={modelSupportsVision ? () => void pickImage('gallery') : undefined}
      />
      <ResourcePickerSheet
        visible={resourcePickerVisible}
        onClose={closeResourcePicker}
        onSelect={handleWorkspaceSelect}
      />
      <MemoryToolSheet
        effort={memoryEffort}
        enabled={memoryEnabled}
        visible={memorySheetVisible && !isGroupSession}
        onClose={closeMemorySheet}
        onChangeEffort={(value) => {
          void updateMemoryConfig(true, value);
        }}
        onChangeEnabled={(value) => {
          void updateMemoryConfig(value, memoryEffort);
        }}
      />

      <SkillsSheet
        agentConfigOpenStore={t.agentConfigOpenStore}
        agentSkillItems={agentSkillItems}
        builtinItems={builtinSkillItems}
        enabledIdentifiers={enabledPlugins}
        installedPlugins={installedPlugins}
        loading={loadingSkills}
        skillsEmpty={t.skillsEmpty}
        skillsEmptyDesc={t.skillsEmptyDesc}
        skillsTitle={t.skillsTitle}
        visible={skillsSheetVisible && !isGroupSession}
        onClose={closeSkillsSheet}
        onOpenStore={() => navigation.navigate('MainTabs', { screen: 'Store' })}
        onToggle={togglePlugin}
      />
    </View>
  );
}
