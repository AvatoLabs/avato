/**
 * ChatDetailScreen — Full chat experience with MessageBubble, Topics, and file attachments.
 */
import { useFocusEffect } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowDown,
  ArrowLeft,
  BookOpen,
  Brain,
  BrainCircuit,
  Cpu,
  Eraser,
  Globe,
  MessageCircle,
  Paperclip,
  Puzzle,
  Send,
  Settings,
  Square,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Dimensions,
  Image as RNImage,
  Keyboard,
  LayoutAnimation,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AttachmentSheet from '../components/ui/AttachmentSheet';
import {
  ComposerCountBadge,
  ComposerPrimaryAction,
  ComposerShell,
} from '../components/ui/ComposerShell';
import EmptyState from '../components/ui/EmptyState';
import FilePreview from '../components/ui/FilePreview';
import { GroupMentionInput } from '../components/ui/GroupMentionInput';
import MemoryToolSheet from '../components/ui/MemoryToolSheet';
import MessageBubble, { type GroupMessageSpeaker } from '../components/ui/MessageBubble';
import MessageListSkeleton from '../components/ui/MessageListSkeleton';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import PressableScale from '../components/ui/PressableScale';
import ResourcePickerSheet from '../components/ui/ResourcePickerSheet';
import SkillsSheet from '../components/ui/SkillsSheet';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import type { MobileRecommendedBuiltinIcon } from '../constants/recommendedBuiltins';
import { MOBILE_RECOMMENDED_BUILTIN_SKILLS } from '../constants/recommendedBuiltins';
import {
  agentApi,
  agentGroupApi,
  type AgentGroupDetail,
  agentSkillApi,
  getApiUrl,
  messageApi,
  pluginApi,
  sessionApi,
  topicApi,
  userApi,
} from '../lib/api';
import { buildDisplayMessages } from '../lib/groupTasksTransform';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { isGroupSessionLike } from '../lib/session';
import { loadSkillPickerSelection, saveSkillPickerSelection } from '../lib/skillPicker';
import { generateBestTitle } from '../lib/titleGeneration';
import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useModelStore } from '../store/model';
import { useSessionStore } from '../store/session';
import { useThemeStore } from '../store/theme';
import { useTopicStore } from '../store/topic';
import { getUserMemorySettings } from '../store/user';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';
import type {
  AgentSkillItem,
  ChatMessage,
  FileListItem,
  InstalledPlugin,
  MobileMemoryEffort,
} from '../types';

const EMPTY_MESSAGES: ChatMessage[] = [];

export default function ChatDetailScreen({ route, navigation }: any) {
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
  const primaryColor = colors.primary;

  const session = useSessionStore((s) => s.sessions.find((sess) => sess.id === sessionId));
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const isGroupSession = isGroupSessionLike(sessionId, session?.type);

  const rawMessages = useChatStore((s) => s.messagesBySession[sessionKey] ?? EMPTY_MESSAGES);
  const messages = useMemo(
    () => buildDisplayMessages(rawMessages, isGroupSession),
    [rawMessages, isGroupSession],
  );
  const fetchingMessages = useChatStore((s) => s.fetchingMessagesBySession[sessionKey] ?? false);
  const generating = useChatStore((s) => s.generating && s.activeStreamingSessionId === sessionKey);
  const isReasoning = useChatStore((s) => s.isReasoning);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGenerating = useChatStore((s) => s.stopGenerating);
  const fetchMessages = useChatStore((s) => s.fetchMessages);

  const activeTopic = useTopicStore((s) => s.activeTopicBySession[sessionKey] ?? null);
  const topics = useTopicStore((s) => s.topicsBySession[sessionKey] ?? []);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);
  const switchTopic = useTopicStore((s) => s.switchTopic);
  const activeTopicItem = useMemo(
    () => topics.find((topic) => topic.id === activeTopic) ?? null,
    [activeTopic, topics],
  );

  const pendingFiles = useFileStore((s) => s.pendingFiles);
  const addFile = useFileStore((s) => s.addFile);

  const [inputText, setInputText] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryEffort, setMemoryEffort] = useState<MobileMemoryEffort>('medium');
  const [globalMemoryEnabled, setGlobalMemoryEnabled] = useState(true);
  const [globalMemoryEffort, setGlobalMemoryEffort] = useState<MobileMemoryEffort>('medium');
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [resourcePickerVisible, setResourcePickerVisible] = useState(false);
  const [providerLogoError, setProviderLogoError] = useState(false);
  const listRef = useRef<FlashList<ChatMessage>>(null);
  const isScrolledToBottom = useRef(true);
  const autoScrollLocked = useRef(false);
  const lastAutoScrollAt = useRef(0);
  const hasObservedTopicChange = useRef(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  // Skills drawer
  const [skillsSheetVisible, setSkillsSheetVisible] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [builtinSkillItems, setBuiltinSkillItems] = useState<
    { description: string; icon: MobileRecommendedBuiltinIcon; identifier: string; title: string }[]
  >([]);
  const [agentSkillItems, setAgentSkillItems] = useState<AgentSkillItem[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [enabledPlugins, setEnabledPlugins] = useState<Set<string>>(() => new Set());
  const [agentId, setAgentId] = useState<string | null>(null);
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

  useEffect(() => {
    if (!sessionId) return;
    fetchModels();
    loadSelection(sessionId);
  }, [fetchModels, loadSelection, sessionId]);

  useEffect(() => {
    hasObservedTopicChange.current = false;
  }, [sessionId]);

  useEffect(() => {
    isScrolledToBottom.current = true;
    autoScrollLocked.current = false;
    lastAutoScrollAt.current = 0;
  }, [activeTopic, sessionId]);

  // Sync route topicId to store immediately (useLayoutEffect so it runs before useFocusEffect)
  useLayoutEffect(() => {
    if (!sessionId) return;
    if (initialTopicId != null) {
      switchTopic(sessionId, initialTopicId);
    }
  }, [initialTopicId, sessionId, switchTopic]);

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

      const state = useChatStore.getState();
      const shouldStop =
        state.generating &&
        state.activeStreamingSessionId === sessionId &&
        typeof state.activeOperationId === 'string';

      if (!shouldStop) return;

      console.warn(`[ChatDetail] stopping active group operation on ${reason}`);
      stopGenerating();
    },
    [sessionId, stopGenerating],
  );

  useEffect(() => {
    void loadGroupDetail();
  }, [loadGroupDetail]);

  useFocusEffect(
    useCallback(() => {
      void loadGroupDetail();
    }, [loadGroupDetail]),
  );

  // Refresh messages/topics when screen gains focus (align with Web revalidateOnFocus)
  // Prefer initialTopicId from route over store — avoids fetching historical topic when navigating from home send
  useFocusEffect(
    useCallback(() => {
      if (!sessionId) return;
      const state = useChatStore.getState();
      if (state.generating && state.activeStreamingSessionId === sessionId) return;
      const topicId =
        initialTopicId ?? useTopicStore.getState().activeTopicBySession[sessionKey] ?? undefined;
      void fetchSessions();
      fetchMessages(sessionId, topicId, { preferPopulatedTopic: true });
      void fetchTopics(sessionId).then(() => {
        // Re-assert initialTopicId after fetchTopics; it may have overwritten with nextTopics[0]
        if (initialTopicId != null) {
          switchTopic(sessionId, initialTopicId);
        }
      });
    }, [initialTopicId, sessionId, sessionKey, fetchMessages, fetchSessions, fetchTopics, switchTopic]),
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        stopActiveGroupOperation('blur');
      };
    }, [stopActiveGroupOperation]),
  );

  useEffect(() => {
    let disposed = false;

    getUserMemorySettings().then((settings) => {
      if (disposed) return;

      setGlobalMemoryEnabled(settings.enabled);
      setGlobalMemoryEffort(settings.effort);
    });

    return () => {
      disposed = true;
    };
  }, []);

  const inputPaddingBottom = Math.max(insets.bottom, 8);
  useEffect(() => {
    const handleKeyboardShow = (event: any) => {
      const coords = event?.endCoordinates;
      const windowHeight = Dimensions.get('window').height;
      const screenY = Number(coords?.screenY ?? windowHeight);
      const offsetFromBottom = windowHeight - screenY;
      if (offsetFromBottom > 0) {
        setKeyboardOffset(offsetFromBottom);
      } else {
        setKeyboardOffset(0);
      }
    };
    const handleKeyboardHide = () => {
      setKeyboardOffset(0);
    };

    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
            Keyboard.addListener('keyboardWillHide', handleKeyboardHide),
            Keyboard.addListener('keyboardWillChangeFrame', (event) => {
              const windowHeight = Dimensions.get('window').height;
              const screenY = Number(event?.endCoordinates?.screenY ?? windowHeight);
              if (screenY >= windowHeight - 1) {
                handleKeyboardHide();
              } else {
                handleKeyboardShow(event);
              }
            }),
          ]
        : [
            Keyboard.addListener('keyboardDidShow', handleKeyboardShow),
            Keyboard.addListener('keyboardDidHide', handleKeyboardHide),
          ];

    return () => {
      for (const subscription of subscriptions) {
        subscription.remove();
      }
    };
  }, [inputPaddingBottom]);

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

  useEffect(() => {
    if (!sessionId || generating) return;

    if (!hasObservedTopicChange.current) {
      hasObservedTopicChange.current = true;
      return;
    }

    fetchMessages(sessionId, activeTopic ?? undefined);
  }, [sessionId, fetchMessages, activeTopic, generating]);

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
      if (
        useChatStore.getState().generating &&
        useChatStore.getState().activeStreamingSessionId === sessionId
      ) {
        return;
      }

      const topicId = useTopicStore.getState().activeTopicBySession[sessionKey] ?? undefined;
      void Promise.allSettled([
        fetchSessions(),
        fetchTopics(sessionId),
        fetchMessages(sessionId, topicId, { preferPopulatedTopic: true, preserveOnEmpty: true }),
      ]);
    });

    return () => {
      subscription.remove();
    };
  }, [fetchMessages, fetchSessions, fetchTopics, sessionId, sessionKey, stopActiveGroupOperation]);

  useEffect(() => {
    if (!generating) return;
    const WATCHDOG_MS = 180_000;
    const startedAt = useChatStore.getState().generatingStartedAt;
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    const remaining = Math.max(WATCHDOG_MS - elapsed, 0);
    const timer = setTimeout(() => {
      if (useChatStore.getState().generating) {
        console.warn('[ChatDetail] generating watchdog triggered, force-stopping');
        stopGenerating();
      }
    }, remaining);
    return () => clearTimeout(timer);
  }, [generating, stopGenerating]);

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

  useEffect(() => {
    if (!sessionId || isGroupSession) {
      setAgentId(null);
      setEnabledPlugins(new Set());
      return;
    }
    Promise.all([
      agentApi.getConfigBySession(sessionId).catch(() => null),
      loadSkillPickerSelection(),
    ])
      .then(([config, persistedSelection]) => {
        if (config) {
          setAgentId(config.id);
          setEnabledPlugins(
            new Set(Array.isArray(config.plugins) ? config.plugins : persistedSelection),
          );
        } else {
          setAgentId(null);
          setEnabledPlugins(new Set(persistedSelection));
          console.warn('[ChatDetail] no agent config for session:', sessionId);
        }
      })
      .catch((err) => {
        console.error('[ChatDetail] failed to load agent config:', err);
      });
  }, [isGroupSession, sessionId]);

  const sessionSearchMode = session?.chatConfig?.searchMode;
  const sessionMemoryEnabled = session?.chatConfig?.memory?.enabled;
  const sessionMemoryEffort = session?.chatConfig?.memory?.effort;

  useEffect(() => {
    setSearchEnabled(sessionSearchMode ? sessionSearchMode !== 'off' : false);
    setMemoryEnabled(sessionMemoryEnabled ?? globalMemoryEnabled);
    setMemoryEffort(sessionMemoryEffort || globalMemoryEffort);
  }, [
    globalMemoryEffort,
    globalMemoryEnabled,
    sessionMemoryEffort,
    sessionMemoryEnabled,
    sessionSearchMode,
  ]);

  const handlePluginsPress = useCallback(() => {
    if (isGroupSession) return;
    haptics.light();
    setSkillsSheetVisible(true);
    // Pre-load builtins immediately so they appear without waiting for API
    const preloadBuiltins = MOBILE_RECOMMENDED_BUILTIN_SKILLS.map((b) => ({
      description: (t as any)[b.descriptionKey] ?? '',
      icon: b.icon,
      identifier: b.identifier,
      title: (t as any)[b.titleKey] ?? b.identifier,
    }));
    setBuiltinSkillItems(preloadBuiltins);
    setLoadingSkills(true);

    const loadSkills = async (attempt = 0) => {
      const maxAttempts = 2;
      try {
        const [plugins, skills, userState] = await Promise.all([
          pluginApi.list().catch((e) => {
            if (attempt === 0) console.warn('[ChatDetailScreen] pluginApi.list failed:', e);
            return [];
          }),
          agentSkillApi.list().catch((e) => {
            if (attempt === 0) console.warn('[ChatDetailScreen] agentSkillApi.list failed:', e);
            return [];
          }),
          userApi.getState().catch(() => null),
        ]);
        const uninstalled = userState?.settings?.tool?.uninstalledBuiltinTools ?? [];
        const builtins = MOBILE_RECOMMENDED_BUILTIN_SKILLS.filter(
          (b) => !uninstalled.includes(b.identifier),
        ).map((b) => ({
          description: (t as any)[b.descriptionKey] ?? '',
          icon: b.icon,
          identifier: b.identifier,
          title: (t as any)[b.titleKey] ?? b.identifier,
        }));
        setBuiltinSkillItems(builtins);

        const builtinIds = new Set(builtins.map((b) => b.identifier));
        const filteredSkills = (skills ?? []).filter((s) => {
          const id = s.identifier ?? s.id;
          return id && !builtinIds.has(id);
        });
        setAgentSkillItems(filteredSkills);

        const skillIds = new Set(filteredSkills.map((s) => s.identifier).filter(Boolean));
        const filteredPlugins = (plugins ?? []).filter(
          (p) => !builtinIds.has(p.identifier) && !skillIds.has(p.identifier),
        );
        setInstalledPlugins(filteredPlugins);
      } catch (e) {
        console.warn('[ChatDetailScreen] loadSkills failed:', e);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 400));
          return loadSkills(attempt + 1);
        }
      }
    };
    void loadSkills().finally(() => setLoadingSkills(false));
  }, [isGroupSession, t]);

  const handleTogglePlugin = useCallback(
    (identifier: string) => {
      if (!sessionId) return;
      haptics.light();
      setEnabledPlugins((prev) => {
        const next = new Set(prev);
        if (next.has(identifier)) {
          next.delete(identifier);
        } else {
          next.add(identifier);
        }
        const pluginArr = [...next];
        void saveSkillPickerSelection(pluginArr);
        if (agentId) {
          agentApi.updateConfig(agentId, { plugins: pluginArr }).catch(console.error);
        } else {
          agentApi
            .getConfigBySession(sessionId)
            .then((config) => {
              if (config?.id) {
                setAgentId(config.id);
                agentApi.updateConfig(config.id, { plugins: pluginArr }).catch(console.error);
              } else {
                sessionApi
                  .updateSessionConfig(sessionId, { plugins: pluginArr })
                  .catch(console.error);
              }
            })
            .catch(console.error);
        }
        return next;
      });
    },
    [agentId, sessionId],
  );

  const selectedProviderLogo = useMemo(
    () => modelProviders.find((provider) => provider.id === sessionProvider)?.logo,
    [modelProviders, sessionProvider],
  );
  const toolbarProviderLogo =
    selectedProviderLogo ||
    (sessionProvider ? getProviderIconUrl(sessionProvider, effectiveTheme) : undefined);

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
    setProviderLogoError(false);
  }, [toolbarProviderLogo, sessionProvider]);

  const sendScale = useSharedValue(1);
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

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
    if (!sessionId || (!inputText.trim() && pendingFiles.length === 0) || generating) return;
    haptics.light();
    autoScrollLocked.current = false;
    isScrolledToBottom.current = true;
    sendScale.value = withSequence(withSpring(0.8, { damping: 8 }), withSpring(1, { damping: 6 }));
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const textToSend = inputText.trim();
    setInputText('');
    Keyboard.dismiss();
    const success = await sendMessage(sessionId, textToSend, activeTopic ?? undefined, {
      memoryEffort,
      memoryEnabled,
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
    pendingFiles.length,
    memoryEffort,
    memoryEnabled,
    searchEnabled,
    sendScale,
  ]);

  const pickImage = useCallback(
    async (source: 'camera' | 'gallery') => {
      try {
        if (source === 'camera') {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
        } else {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
        }

        const result =
          source === 'camera'
            ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 })
            : await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                quality: 0.8,
                allowsMultipleSelection: true,
              });

        if (!result.canceled) {
          for (const asset of result.assets) {
            addFile({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              name: asset.fileName || 'image.jpg',
              type: asset.mimeType || 'image/jpeg',
              size: asset.fileSize || 0,
              uri: asset.uri,
            });
          }
        }
      } catch (err) {
        if (err && typeof err === 'object' && 'code' in err && err.code === 'ERR_CANCELED') return;
        toast.show('error', t.fileUploadError);
      }
    },
    [addFile, t, toast],
  );

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        for (const asset of result.assets) {
          addFile({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: asset.name,
            type: asset.mimeType || 'application/octet-stream',
            size: asset.size || 0,
            uri: asset.uri,
          });
        }
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code === 'ERR_CANCELED') return;
      toast.show('error', t.fileUploadError);
    }
  }, [addFile, t, toast]);

  const handleAttach = useCallback(() => {
    haptics.selection();
    setAttachmentSheetVisible(true);
  }, []);

  const handleFromWorkspace = useCallback(() => {
    setResourcePickerVisible(true);
  }, []);

  const handleWorkspaceSelect = useCallback(
    async (items: FileListItem[]) => {
      const base = await getApiUrl();
      const baseUrl = base?.replace(/\/$/, '') ?? '';
      for (const item of items) {
        if (item.sourceType !== 'file' || !item.id || item.id.startsWith('docs_')) continue;

        const fileUrl = item.url?.startsWith('http')
          ? item.url
          : baseUrl
            ? `${baseUrl}/f/${item.id}`
            : item.url;
        addFile({
          fileId: item.id,
          id: `workspace-${item.id}-${Date.now()}`,
          name: item.name,
          size: item.size,
          type: item.fileType,
          uri: fileUrl || `file://${item.id}`,
          url: fileUrl,
        });
      }
    },
    [addFile],
  );

  // ── Toolbar: Model ────────────────────────────────────────────────
  const handleModelPress = useCallback(() => {
    if (isGroupSession) return;
    haptics.light();
    setModelDrawerVisible(true);
  }, [isGroupSession]);

  // ── Toolbar: Search toggle ────────────────────────────────────────
  const handleToggleSearch = useCallback(async () => {
    if (!sessionId || isGroupSession) return;
    haptics.light();
    const next = !searchEnabled;
    setSearchEnabled(next);
    try {
      await sessionApi.updateChatConfig(sessionId, { searchMode: next ? 'on' : 'off' });
    } catch {
      /* best-effort */
    }
  }, [isGroupSession, searchEnabled, sessionId]);

  const updateMemoryConfig = useCallback(
    async (nextEnabled: boolean, nextEffort: MobileMemoryEffort) => {
      if (!sessionId || isGroupSession) return;
      setMemoryEnabled(nextEnabled);
      setMemoryEffort(nextEffort);

      try {
        await sessionApi.updateChatConfig(sessionId, {
          memory: {
            effort: nextEffort,
            enabled: nextEnabled,
          },
        });
      } catch {
        /* best-effort */
      }
    },
    [isGroupSession, sessionId],
  );

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
    if (activeTopic) {
      return;
    }
    try {
      const topicId = await topicApi.create(sessionId, t.topicTitle, {
        sessionType: session?.type ?? 'agent',
      });
      if (topicId) {
        haptics.success();
        fetchTopics(sessionId);
      }
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [session?.type, sessionId, activeTopic, t, toast, fetchTopics]);

  const handleOpenNotebook = useCallback(async () => {
    if (!sessionId) return;

    haptics.light();

    try {
      const currentTopicId = activeTopic ?? initialTopicId;

      if (currentTopicId) {
        navigation.navigate('Notebook', { sessionId, topicId: currentTopicId });
        return;
      }

      const topicId = await topicApi.create(sessionId, t.topicTitle, {
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
    session?.type,
    sessionId,
    switchTopic,
    t.errorNetwork,
    t.topicTitle,
    toast,
  ]);

  const renderMessage = useCallback(
    ({ item }: { item: ChatMessage }) => (
      <MessageBubble
        generating={generating}
        groupMembersById={groupMembersById}
        groupSupervisorId={groupDetail?.supervisorAgentId}
        message={item}
        sessionId={sessionId || sessionKey}
        topicId={activeTopic ?? null}
        onSaveToTopic={handleSaveToTopic}
      />
    ),
    [
      activeTopic,
      generating,
      groupDetail?.supervisorAgentId,
      groupMembersById,
      handleSaveToTopic,
      sessionId,
      sessionKey,
    ],
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
      {/* Header */}
      <BlurView
        className="z-10"
        intensity={90}
        style={{ paddingTop: insets.top }}
        tint={effectiveTheme === 'dark' ? 'dark' : 'light'}
      >
        <View className="flex-row items-center justify-between px-4 py-2.5">
          <View className="flex-row items-center flex-1">
            <PressableScale
              accessibilityLabel={t.accessibilityGoBack}
              accessibilityRole="button"
              className="w-9 h-9 items-center justify-center rounded-full mr-2"
              onPress={() => {
                haptics.light();
                navigation.goBack();
              }}
            >
              <ArrowLeft
                color={colors.foreground}
                size={22}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </PressableScale>
            <View className="flex-1">
              <Text
                className="text-[16px] font-medium text-foreground tracking-tight"
                numberOfLines={1}
              >
                {activeTopicItem?.title || session?.title || t.chatTitle}
              </Text>
              {generating ? (
                <Text className="text-[12px] mt-0.5 font-medium" style={{ color: colors.primary }}>
                  {isReasoning ? t.chatThinking : t.chatGenerating}
                </Text>
              ) : !isGroupSession && sessionModel ? (
                <View className="mt-0.5 flex-row items-center" style={{ minHeight: 14 }}>
                  {toolbarProviderLogo && !providerLogoError ? (
                    <RNImage
                      source={{ uri: toolbarProviderLogo }}
                      style={{ borderRadius: 3, height: 13, marginRight: 6, width: 13 }}
                      onError={() => setProviderLogoError(true)}
                    />
                  ) : (
                    <Cpu
                      color={colors.secondaryText}
                      size={13}
                      strokeWidth={tokens.icon.strokeWidth}
                      style={{ marginRight: 6 }}
                    />
                  )}
                  <Text
                    className="flex-1 text-[12px] font-medium"
                    numberOfLines={1}
                    style={{ color: colors.muted, lineHeight: 14 }}
                  >
                    {sessionModel}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          <View className="flex-row items-center gap-1">
            <PressableScale
              accessibilityLabel={t.topicTitle}
              accessibilityRole="button"
              className="w-9 h-9 items-center justify-center rounded-full"
              onLongPress={
                activeTopic
                  ? async () => {
                      haptics.medium();
                      const failMessage = [t.toastTitleGenerationFailed, t.toastTitleGenerationFailedHint]
                        .filter(Boolean)
                        .join(' ');
                      try {
                        const result = await generateBestTitle({
                          sessionId: sessionId!,
                          topicId: activeTopic,
                        });
                        if (result?.title) {
                          haptics.success();
                          toast.show(
                            'success',
                            result.target === 'topic' ? t.topicRenamed : t.sessionRenamed,
                          );
                        } else {
                          toast.show('error', failMessage || 'Failed to generate title');
                        }
                      } catch {
                        toast.show('error', failMessage || 'Failed to generate title');
                      }
                    }
                  : undefined
              }
              onPress={() => {
                haptics.light();
                navigation.navigate('TopicList', { sessionId });
              }}
            >
              <MessageCircle color={colors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
            </PressableScale>
            <PressableScale
              accessibilityLabel={t.notebookTitle}
              accessibilityRole="button"
              className="w-9 h-9 items-center justify-center rounded-full"
              onPress={() => {
                void handleOpenNotebook();
              }}
            >
              <BookOpen color={colors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
            </PressableScale>
            <PressableScale
              accessibilityLabel={t.accessibilitySettings}
              accessibilityRole="button"
              className="w-9 h-9 items-center justify-center rounded-full"
              onPress={() => {
                haptics.light();
                navigation.navigate('ChatSettings', { sessionId });
              }}
            >
              <Settings color={colors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
            </PressableScale>
          </View>
        </View>
      </BlurView>

      {/* Message List + Input */}
      <View className="flex-1">
        {fetchingMessages && messages.length === 0 ? (
          <MessageListSkeleton />
        ) : (
          <FlashList
            accessibilityLiveRegion="polite"
            contentContainerStyle={{ paddingBottom: 12, paddingTop: 12 }}
            data={messages}
            estimatedItemSize={120}
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
                          activeOpacity={0.7}
                          className="px-4 py-2.5 rounded-full bg-foreground/[0.03]"
                          key={label}
                          onPress={() => {
                            haptics.light();
                            setInputText(label);
                          }}
                        >
                          <Text className="text-secondary text-[13px] font-medium">{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </Animated.View>
                  }
                />
              </View>
            }
            onContentSizeChange={autoScrollToEnd}
            onLayout={autoScrollToEnd}
            onScroll={(e) => {
              const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
              const atBottom =
                layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
              isScrolledToBottom.current = atBottom;
              autoScrollLocked.current = !atBottom && contentOffset.y > 24;
              setShowScrollToTop(!atBottom && contentOffset.y > 200);
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
          style={{
            paddingBottom: Math.max(insets.bottom, 8),
            paddingHorizontal: 16,
            paddingTop: 4,
            transform: [{ translateY: Platform.OS === 'ios' ? -keyboardOffset : 0 }],
          }}
        >
          <ComposerShell active={keyboardOffset > 0}>
            {pendingFiles.length > 0 && (
              <View className="px-3 pt-2">
                <FilePreview sessionId={sessionId} />
              </View>
            )}
            {/* Text input — full width (GroupMentionInput for group chat @ mention) */}
            <View className="px-3 pt-2">
              {isGroupSession && groupDetail?.agents?.length ? (
                <GroupMentionInput
                  editable
                  accessibilityLabel={generating ? t.chatGenerating : hints[hintIndex]}
                  className="text-foreground text-[16px] leading-[22px] min-h-[36px] max-h-28"
                  placeholder={generating ? t.chatGenerating : hints[hintIndex]}
                  style={{ paddingVertical: 0, textAlignVertical: 'top' }}
                  value={inputText}
                  members={groupDetail.agents.map((a) => ({
                    avatar: a.avatar,
                    id: a.id,
                    title: a.title,
                  }))}
                  onChangeText={setInputText}
                />
              ) : (
                <TextInput
                  editable
                  multiline
                  accessibilityLabel={generating ? t.chatGenerating : hints[hintIndex]}
                  className="text-foreground text-[16px] leading-[22px] min-h-[36px] max-h-28"
                  placeholder={generating ? t.chatGenerating : hints[hintIndex]}
                  placeholderTextColor={colors.secondaryText}
                  style={{ paddingVertical: 0, textAlignVertical: 'top' }}
                  underlineColorAndroid="transparent"
                  value={inputText}
                  onChangeText={setInputText}
                />
              )}
            </View>
            {/* Action toolbar row */}
            <View className="flex-row items-center px-2 pb-1.5 pt-1">
              {!isGroupSession && (
                <>
                  {/* Model */}
                  <TouchableOpacity
                    accessibilityLabel="Select model"
                    activeOpacity={0.7}
                    className="w-8 h-8 items-center justify-center rounded-full"
                    onPress={handleModelPress}
                  >
                    {toolbarProviderLogo && !providerLogoError ? (
                      <RNImage
                        style={{ width: 20, height: 20, borderRadius: 4 }}
                        source={{
                          uri: toolbarProviderLogo,
                        }}
                        onError={() => setProviderLogoError(true)}
                      />
                    ) : (
                      <Cpu color={colors.secondaryText} size={20} strokeWidth={tokens.icon.strokeWidth} />
                    )}
                  </TouchableOpacity>
                  {/* Search */}
                  <TouchableOpacity
                    accessibilityLabel="Toggle search"
                    activeOpacity={0.7}
                    className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                    onPress={handleToggleSearch}
                  >
                    <Globe
                      color={searchEnabled ? primaryColor : colors.muted}
                      size={20}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  </TouchableOpacity>
                </>
              )}
              {/* Attach */}
              <TouchableOpacity
                accessibilityLabel="Attach file"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                onPress={handleAttach}
              >
                <View className="relative items-center justify-center">
                  <Paperclip
                    color={pendingFiles.length > 0 ? primaryColor : colors.muted}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  {pendingFiles.length > 0 && (
                    <View className="absolute -right-2 -top-1">
                      <ComposerCountBadge
                        color={colors.primary}
                        value={pendingFiles.length > 9 ? '9+' : pendingFiles.length}
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              {!isGroupSession && (
                <>
                  {/* Tools */}
                  <TouchableOpacity
                    accessibilityLabel="Toggle tools"
                    activeOpacity={0.7}
                    className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                    onPress={handlePluginsPress}
                  >
                    <Puzzle
                      color={enabledPlugins.size > 0 ? primaryColor : colors.muted}
                      size={20}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  </TouchableOpacity>
                  {/* Memory */}
                  <TouchableOpacity
                    accessibilityLabel="Toggle memory"
                    activeOpacity={0.7}
                    className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                    onPress={() => {
                      haptics.light();
                      setMemorySheetVisible(true);
                    }}
                  >
                    {memoryEnabled ? (
                      <BrainCircuit
                        color={primaryColor}
                        size={20}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                    ) : (
                      <Brain color={colors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
                    )}
                  </TouchableOpacity>
                </>
              )}
              {/* Separator */}
              <View className="w-px h-4 bg-black/10 mx-1" />
              {/* Clear */}
              <TouchableOpacity
                accessibilityLabel="Clear messages"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full"
                onPress={handleClear}
              >
                <Eraser color={colors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
              </TouchableOpacity>
              {/* Spacer */}
              <View className="flex-1" />
              {/* Send / Stop */}
              {generating ? (
                <Animated.View style={sendAnimStyle}>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    className="w-9 h-9 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.muted }}
                    onPress={handleStop}
                  >
                    <Square
                      color={colors.iconOnPrimary}
                      fill={colors.iconOnPrimary}
                      size={12}
                      strokeWidth={0}
                    />
                  </TouchableOpacity>
                </Animated.View>
              ) : inputText.trim() || pendingFiles.length > 0 ? (
                <Animated.View style={sendAnimStyle}>
                  <ComposerPrimaryAction
                    active
                    onPress={handleSend}
                  >
                    <Send
                      color={colors.iconOnPrimary}
                      size={16}
                      strokeWidth={tokens.icon.strokeWidth}
                      style={{ marginLeft: 1 }}
                    />
                  </ComposerPrimaryAction>
                </Animated.View>
              ) : (
                <View className="w-9 h-9" />
              )}
            </View>
          </ComposerShell>
        </Animated.View>
      </View>

      <ModelDrawer
        sessionId={sessionId}
        visible={modelDrawerVisible && !isGroupSession}
        onClose={() => setModelDrawerVisible(false)}
        onSelect={() => setProviderLogoError(false)}
      />
      <AttachmentSheet
        visible={attachmentSheetVisible}
        onCamera={modelSupportsVision ? () => void pickImage('camera') : undefined}
        onClose={() => setAttachmentSheetVisible(false)}
        onDocument={() => void pickDocument()}
        onFromWorkspace={handleFromWorkspace}
        onGallery={modelSupportsVision ? () => void pickImage('gallery') : undefined}
      />
      <ResourcePickerSheet
        visible={resourcePickerVisible}
        onClose={() => setResourcePickerVisible(false)}
        onSelect={handleWorkspaceSelect}
      />
      <MemoryToolSheet
        effort={memoryEffort}
        enabled={memoryEnabled}
        visible={memorySheetVisible && !isGroupSession}
        onClose={() => setMemorySheetVisible(false)}
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
        onClose={() => setSkillsSheetVisible(false)}
        onOpenStore={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Store' })}
        onToggle={handleTogglePlugin}
      />
    </View>
  );
}
