/**
 * ChatListScreen → mobile home draft surface + assistant directory drawer.
 *
 * Home shows a draft composer like ChatGPT app.
 * Assistant / group directory lives behind the top-left button.
 *
 * Mobile home semantic contract:
 * - Session: container for an assistant or a group
 * - Topic: one conversation thread under a session
 * - Home opens in draft state and does not create a new topic until first send
 * - Directory drawer shows assistants first, groups after
 */
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Bot,
  Brain,
  BrainCircuit,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Globe,
  Menu,
  MessageCircle,
  MessageSquarePlus,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Puzzle,
  Search,
  Send,
  Tag,
  Trash2,
  UsersRound,
  Wand2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Image as RNImage,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';

import AgentSelectionSheet from '../components/ui/AgentSelectionSheet';
import AttachmentSheet from '../components/ui/AttachmentSheet';
import EmptyState from '../components/ui/EmptyState';
import FilePreview from '../components/ui/FilePreview';
import ListSkeleton from '../components/ui/ListSkeleton';
import MemoryToolSheet from '../components/ui/MemoryToolSheet';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import PressableScale from '../components/ui/PressableScale';
import PromptModal from '../components/ui/PromptModal';
import ResourcePickerSheet from '../components/ui/ResourcePickerSheet';
import { SectionBlock } from '../components/ui/SectionBlock';
import SkillsSheet from '../components/ui/SkillsSheet';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl, inferProviderFromModelId } from '../constants/cdn';
import type { MobileRecommendedBuiltinIcon } from '../constants/recommendedBuiltins';
import { MOBILE_RECOMMENDED_BUILTIN_SKILLS } from '../constants/recommendedBuiltins';
import {
  AVATO_INBOX_ICON_ASSET,
  DEFAULT_INBOX_AVATAR,
  INBOX_SESSION_ID,
  isBuiltinInboxAvatar,
} from '../constants/session';
import { resolveTagColor, withAlpha } from '../constants/tags';
import {
  agentApi,
  agentGroupApi,
  agentSkillApi,
  getApiUrl,
  messageApi,
  type MessageSearchResult,
  pluginApi,
  sessionApi,
  tagApi,
  topicApi,
  userApi,
} from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { navigateToLogin } from '../lib/navigation';
import { useResolvedRemoteAsset } from '../lib/remoteAsset';
import { loadSkillPickerSelection, saveSkillPickerSelection } from '../lib/skillPicker';
import { getStreak, recordUsage } from '../lib/streak';
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
  ChatSession,
  FileListItem,
  InstalledPlugin,
  MobileMemoryEffort,
  RecentTopic,
  Tag as TagItem,
  Topic,
} from '../types';

type RelativeTimeText = {
  relativeTimeDays: string;
  relativeTimeHours: string;
  relativeTimeMinutes: string;
  relativeTimeNow: string;
};

interface SearchSessionResult {
  id: string;
  matchedAt?: string;
  matchType: 'message' | 'session' | 'topic';
  messageId?: string;
  session: ChatSession;
  summary: string;
  topicId?: string;
}

const sortTags = (tags: TagItem[]) =>
  [...tags].sort((left, right) => {
    const leftSort = left.sort ?? Number.MAX_SAFE_INTEGER;
    const rightSort = right.sort ?? Number.MAX_SAFE_INTEGER;
    if (leftSort !== rightSort) return leftSort - rightSort;
    return left.name.localeCompare(right.name);
  });

const trimSearchSnippet = (value: string, maxLength = 88) => {
  const normalized = value.replaceAll(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) return normalized;

  return `${normalized.slice(0, maxLength - 1)}…`;
};

const DIRECTORY_DRAWER_WIDTH = Dimensions.get('window').width;

function formatTimeAgo(dateStr: string, t: RelativeTimeText): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return t.relativeTimeNow;
  if (minutes < 60) return t.relativeTimeMinutes.replace('{count}', String(minutes));
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t.relativeTimeHours.replace('{count}', String(hours));
  const days = Math.floor(hours / 24);
  return t.relativeTimeDays.replace('{count}', String(days));
}

function SessionLogo({
  avatar,
  isInbox = false,
  isGroup,
  provider,
  providerLogo,
  size = 36,
}: {
  avatar?: string;
  isInbox?: boolean;
  isGroup?: boolean;
  provider?: string;
  providerLogo?: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);
  const colors = useThemeColors();
  const iconSize = size * 0.65;
  const iconUrl =
    providerLogo || (provider ? getProviderIconUrl(provider, effectiveTheme) : undefined);
  const resolvedAvatarUri = useResolvedRemoteAsset(avatar);
  const isInboxAvatar = isBuiltinInboxAvatar(avatar);

  useEffect(() => {
    setImgError(false);
  }, [iconUrl, resolvedAvatarUri]);

  if (avatar) {
    if (isInboxAvatar && isInbox) {
      return (
        <View
          className="rounded-full bg-foreground/5 items-center justify-center overflow-hidden"
          style={{ width: size, height: size }}
        >
          <Image
            source={AVATO_INBOX_ICON_ASSET}
            style={{
              width: size,
              height: size,
              ...(effectiveTheme === 'dark' ? { tintColor: colors.foreground } : {}),
            }}
          />
        </View>
      );
    }

    if (isInboxAvatar && iconUrl && !imgError) {
      return (
        <View
          className="rounded-full bg-foreground/5 items-center justify-center"
          style={{ width: size, height: size }}
        >
          <RNImage
            source={{ uri: iconUrl }}
            style={{ width: iconSize, height: iconSize }}
            onError={() => setImgError(true)}
          />
        </View>
      );
    }

    if (isInboxAvatar && !isInbox) {
      // Non-inbox sessions should not inherit the Avato builtin avatar.
      // Fall through to provider/model branding below instead.
    } else if (avatar.length <= 4 && !resolvedAvatarUri) {
      // If it's an emoji (length <= 4 and not a URL), render as text
      return (
        <View
          className="rounded-full bg-foreground/5 items-center justify-center"
          style={{ width: size, height: size }}
        >
          <Text style={{ color: colors.foreground, fontSize: size * 0.6 }}>{avatar}</Text>
        </View>
      );
    }

    if (resolvedAvatarUri && !(isInboxAvatar && !isInbox)) {
      return (
        <View
          className="rounded-full bg-foreground/5 items-center justify-center overflow-hidden"
          style={{ width: size, height: size }}
        >
          <Image
            source={{ uri: resolvedAvatarUri }}
            style={{ width: size, height: size }}
          />
        </View>
      );
    }

    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Text
          className="font-semibold"
          style={{ color: colors.secondaryText, fontSize: size * 0.35 }}
        >
          {avatar.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  if (iconUrl && !imgError) {
    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <RNImage
          source={{ uri: iconUrl }}
          style={{ width: iconSize, height: iconSize }}
          onError={() => setImgError(true)}
        />
      </View>
    );
  }

  if (provider) {
    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Text
          className="font-semibold"
          style={{ color: colors.secondaryText, fontSize: size * 0.35 }}
        >
          {provider.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="rounded-full bg-foreground/5 items-center justify-center"
      style={{ width: size, height: size }}
    >
      {isGroup ? (
        <UsersRound
          color={colors.primary}
          size={size * 0.55}
          strokeWidth={tokens.icon.strokeWidth}
        />
      ) : (
        <Text
          className="font-semibold"
          style={{ color: colors.primary, fontSize: size * 0.55 }}
        >
          #
        </Text>
      )}
    </View>
  );
}

export default function ChatListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);

  const [streak, setStreak] = useState(0);

  const {
    sessions,
    initialized,
    loading,
    errorMessage: sessionErrorMessage,
  } = useSessionStore(
    useShallow((s) => ({
      errorMessage: s.errorMessage,
      sessions: s.sessions,
      initialized: s.initialized,
      loading: s.loading,
    })),
  );
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const removeSession = useSessionStore((s) => s.removeSession);
  const pinSession = useSessionStore((s) => s.pinSession);
  const unpinSession = useSessionStore((s) => s.unpinSession);
  const renameSession = useSessionStore((s) => s.renameSession);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const fetchTopics = useTopicStore((s) => s.fetchTopics);
  const topicsBySession = useTopicStore((s) => s.topicsBySession);
  const removeTopic = useTopicStore((s) => s.removeTopic);
  const updateTopicTag = useTopicStore((s) => s.updateTopicTag);
  const updateTopic = useTopicStore((s) => s.updateTopic);
  const pendingFiles = useFileStore((s) => s.pendingFiles);
  const addFile = useFileStore((s) => s.addFile);

  const selectedModel = useModelStore((s) => s.selectedModel);
  const selectedProvider = useModelStore((s) => s.selectedProvider);
  const modelProviders = useModelStore((s) => s.providers);
  const fetchModels = useModelStore((s) => s.fetchModels);
  const loadSelection = useModelStore((s) => s.loadSelection);
  const modelSupportsVision = useMemo(() => {
    if (!selectedModel || modelProviders.length === 0) return true;

    for (const provider of modelProviders) {
      if (selectedProvider && provider.id !== selectedProvider) continue;
      const model = provider.children.find((child) => child.id === selectedModel);
      if (model) return !!model.abilities?.vision;
    }

    return true;
  }, [modelProviders, selectedModel, selectedProvider]);
  const selectedProviderLogo = useMemo(
    () => modelProviders.find((provider) => provider.id === selectedProvider)?.logo,
    [modelProviders, selectedProvider],
  );
  const toolbarProviderLogo =
    selectedProviderLogo ||
    (selectedProvider ? getProviderIconUrl(selectedProvider, effectiveTheme) : undefined);

  const [heroText, setHeroText] = useState('');
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [providerLogoError, setProviderLogoError] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchSessionResult[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [inboxSession, setInboxSession] = useState<ChatSession | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionSession, setActionSession] = useState<ChatSession | null>(null);
  const [_actionPanel, setActionPanel] = useState<'root' | 'move-tag'>('root');
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const [createGroupSheetVisible, setCreateGroupSheetVisible] = useState(false);
  const [draftAssistantPickerVisible, setDraftAssistantPickerVisible] = useState(false);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [directoryVisible, setDirectoryVisible] = useState(false);
  const [directoryMounted, setDirectoryMounted] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [resourcePickerVisible, setResourcePickerVisible] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryEffort, setMemoryEffort] = useState<MobileMemoryEffort>('medium');
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false);
  const [skillsVisible, setSkillsVisible] = useState(false);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [builtinSkillItems, setBuiltinSkillItems] = useState<
    { description: string; icon: MobileRecommendedBuiltinIcon; identifier: string; title: string }[]
  >([]);
  const [agentSkillItems, setAgentSkillItems] = useState<AgentSkillItem[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [enabledSkills, setEnabledSkills] = useState<Set<string>>(() => new Set());
  const searchInputRef = useRef<TextInput>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ChatSession | null>(null);
  const [expandedSessionIds, setExpandedSessionIds] = useState<Set<string>>(() => new Set());
  const [recentTopics, setRecentTopics] = useState<RecentTopic[]>([]);
  const [topicRenameTarget, setTopicRenameTarget] = useState<{
    sessionId: string;
    title: string;
    topicId: string;
  } | null>(null);
  const [topicTagTarget, setTopicTagTarget] = useState<{
    sessionId: string;
    topicId: string;
    currentTagId?: string | null;
  } | null>(null);
  const [topicActionTarget, setTopicActionTarget] = useState<{
    onAfterDelete?: () => void;
    sessionId: string;
    topicId: string;
    topicTitle?: string;
    topicType?: string;
    topicTagId?: string | null;
  } | null>(null);
  const inboxSessionPromiseRef = useRef<Promise<ChatSession | null> | null>(null);
  const [persistedSkillIdentifiers, setPersistedSkillIdentifiers] = useState<string[]>([]);
  const drawerTranslateX = useSharedValue(-DIRECTORY_DRAWER_WIDTH);
  const drawerBackdropOpacity = useSharedValue(0);
  const inputPaddingBottom = Math.max(insets.bottom, 8);
  const hints = useMemo(
    () => [t.chatAskAnything, t.chatHint1, t.chatHint2, t.chatHint3, t.chatHint4],
    [t],
  );
  const [hintIndex, setHintIndex] = useState(0);
  const visibleSessions = useMemo(() => {
    const assistants = sessions.filter(
      (session) => session.type !== 'group' && session.id !== inboxSession?.id,
    );
    const groups = sessions.filter((session) => session.type === 'group');
    return [...assistants, ...groups];
  }, [inboxSession?.id, sessions]);
  const visibleInboxSession = inboxSession;
  const draftAgentSessions = useMemo(() => {
    const entries = [visibleInboxSession, ...visibleSessions.filter((session) => session.type !== 'group')].filter(
      Boolean,
    ) as ChatSession[];

    return entries.filter(
      (session, index, list) => list.findIndex((item) => item.id === session.id) === index,
    );
  }, [visibleInboxSession, visibleSessions]);
  const draftSession = useMemo(
    () =>
      draftAgentSessions.find((session) => session.id === draftSessionId) ??
      draftAgentSessions[0] ??
      null,
    [draftAgentSessions, draftSessionId],
  );
  const draftSessionIsInbox = draftSession?.id === visibleInboxSession?.id;

  const fetchTags = useCallback(
    async (showError = false) => {
      try {
        const list = await tagApi.list();
        setTags(sortTags(list ?? []));
      } catch {
        if (showError) {
          toast.show('error', t.errorNetwork);
        }
      }
    },
    [t.errorNetwork, toast],
  );

  const tagById = useMemo(
    () => Object.fromEntries(tags.map((tag) => [tag.id, tag])),
    [tags],
  );

  const loadGlobalMemorySettings = useCallback(async () => {
    const settings = await getUserMemorySettings();
    setMemoryEnabled(settings.enabled);
    setMemoryEffort(settings.effort);
  }, []);

  const ensureInboxSession = useCallback(
    async (options?: {
      includeComposerConfig?: boolean;
      model?: string;
      plugins?: string[];
      provider?: string;
    }) => {
      if (inboxSessionPromiseRef.current) {
        return inboxSessionPromiseRef.current;
      }

      const promise = (async () => {
        try {
          let inboxConfig = await agentApi.getConfigBySession(INBOX_SESSION_ID).catch(() => null);
          const sessionId = await sessionApi.create({
            model: options?.includeComposerConfig ? options.model : undefined,
            plugins: options?.includeComposerConfig ? options.plugins : undefined,
            provider: options?.includeComposerConfig ? options.provider : undefined,
            slug: INBOX_SESSION_ID,
            title:
              typeof inboxConfig?.title === 'string' && inboxConfig.title.trim().length > 0
                ? inboxConfig.title
                : 'Avato',
          });

          if (!inboxConfig?.id || options?.includeComposerConfig) {
            inboxConfig = await agentApi.getConfigBySession(sessionId).catch(() => inboxConfig);
          }

          if (options?.includeComposerConfig && inboxConfig?.id) {
            const updatePayload: Record<string, unknown> = {
              model: options.model,
              plugins: options.plugins ?? [],
              provider: options.provider,
            };

            await agentApi.updateConfig(inboxConfig.id, updatePayload).catch(() => {
              /* best-effort */
            });

            inboxConfig = {
              ...inboxConfig,
              ...updatePayload,
            };
          }

          const nextInboxSession: ChatSession = {
            avatar:
              typeof inboxConfig?.avatar === 'string' && inboxConfig.avatar.trim().length > 0
                ? inboxConfig.avatar
                : DEFAULT_INBOX_AVATAR,
            createdAt: new Date().toISOString(),
            description:
              typeof inboxConfig?.description === 'string' ? inboxConfig.description : undefined,
            id: sessionId,
            model: typeof inboxConfig?.model === 'string' && inboxConfig.model.length > 0
              ? inboxConfig.model
              : undefined,
            pinned: false,
            provider:
              typeof inboxConfig?.provider === 'string' && inboxConfig.provider.length > 0
                ? inboxConfig.provider
                : undefined,
            title:
              typeof inboxConfig?.title === 'string' && inboxConfig.title.trim().length > 0
                ? inboxConfig.title
                : 'Avato',
            type: 'agent',
            updatedAt: new Date().toISOString(),
          };

          setInboxSession(nextInboxSession);
          return nextInboxSession;
        } catch (error) {
          console.warn('[ChatListScreen] failed to ensure inbox session:', error);
          return null;
        } finally {
          inboxSessionPromiseRef.current = null;
        }
      })();

      inboxSessionPromiseRef.current = promise;
      return promise;
    },
    [],
  );

  useEffect(() => {
    if (!initialized) void fetchSessions();
    void fetchModels();
    void loadSelection();
    void fetchTags();
    void ensureInboxSession();
    void loadSkillPickerSelection().then(setPersistedSkillIdentifiers);
    void loadGlobalMemorySettings();
    // Record usage for streak tracking + milestone celebration
    recordUsage().then(() =>
      getStreak().then((s) => {
        setStreak(s);
        // Milestone celebration
        if (s === 7 || s === 30 || s === 100 || s === 365) {
          haptics.success();
          toast.show('success', t.streakCelebrate.replace('{count}', String(s)));
        }
      }),
    );
  }, [
    fetchTags,
    fetchModels,
    fetchSessions,
    ensureInboxSession,
    initialized,
    loadGlobalMemorySettings,
    loadSelection,
    t.streakCelebrate,
    toast,
  ]);

  // Re-read sessions (with AsyncStorage provider overlay) whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (initialized) {
        void fetchSessions();
      }
      void fetchModels();
      void loadSelection();
      void ensureInboxSession();
      void fetchTags();
      void loadSkillPickerSelection().then(setPersistedSkillIdentifiers);
      void loadGlobalMemorySettings();
      void topicApi.recentTopics(24).then(setRecentTopics).catch(() => setRecentTopics([]));
    }, [
      ensureInboxSession,
      fetchModels,
      fetchTags,
      initialized,
      fetchSessions,
      loadGlobalMemorySettings,
      loadSelection,
    ]),
  );

  useEffect(() => {
    setEnabledSkills(new Set(persistedSkillIdentifiers));
  }, [persistedSkillIdentifiers]);

  useEffect(() => {
    const timer = setInterval(() => setHintIndex((current) => (current + 1) % hints.length), 4000);
    return () => clearInterval(timer);
  }, [hints.length]);

  useEffect(() => {
    setProviderLogoError(false);
  }, [toolbarProviderLogo, selectedProvider]);

  useEffect(() => {
    const handleKeyboardShow = (event: any) => {
      const coords = event?.endCoordinates;
      const windowHeight = Dimensions.get('window').height;
      const screenY = Number(coords?.screenY ?? windowHeight);
      const offsetFromBottom = windowHeight - screenY;

      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardOffset(offsetFromBottom > 0 ? offsetFromBottom + inputPaddingBottom : 0);
    };

    const handleKeyboardHide = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardOffset(0);
    };

    const subscriptions =
      Platform.OS === 'ios'
        ? [
            Keyboard.addListener('keyboardWillShow', handleKeyboardShow),
            Keyboard.addListener('keyboardWillHide', handleKeyboardHide),
            Keyboard.addListener('keyboardWillChangeFrame', handleKeyboardShow),
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

  useEffect(() => {
    if (directoryVisible) {
      setDirectoryMounted(true);
      drawerTranslateX.value = withTiming(0, { duration: 260 });
      drawerBackdropOpacity.value = withTiming(1, { duration: 220 });
      return;
    }

    if (!directoryMounted) return;

    drawerBackdropOpacity.value = withTiming(0, { duration: 180 });
    drawerTranslateX.value = withTiming(-DIRECTORY_DRAWER_WIDTH, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(setDirectoryMounted)(false);
      }
    });
  }, [
    directoryMounted,
    directoryVisible,
    drawerBackdropOpacity,
    drawerTranslateX,
  ]);

  const refreshRecentTopics = useCallback(() => {
    topicApi
      .recentTopics(24)
      .then((data) => setRecentTopics(data ?? []))
      .catch(() => setRecentTopics([]))
      .finally(() => undefined);
  }, []);

  useEffect(() => {
    refreshRecentTopics();
  }, [refreshRecentTopics]);

  useEffect(() => {
    const keywords = searchText.trim();

    if (!keywords) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let isCancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);

      Promise.all([
        sessionApi.search(keywords).catch(() => []),
        topicApi.search(keywords).catch(() => []),
        messageApi.search(keywords).catch(() => []),
      ])
        .then(([matchedSessions, topics, messages]) => {
          if (isCancelled) return;

          const sessionMap = new Map(sessions.map((session) => [session.id, session]));
          const matches: SearchSessionResult[] = [];

          for (const session of matchedSessions) {
            matches.push({
              id: `session-${session.id}`,
              matchedAt: session.updatedAt,
              matchType: 'session',
              session,
              summary: trimSearchSnippet(session.title || t.chatListNewConversation),
            });
          }

          for (const topic of topics) {
            const session = sessionMap.get(topic.sessionId);
            if (!session) continue;

            matches.push({
              id: `topic-${topic.id}`,
              matchedAt: topic.updatedAt || topic.createdAt,
              matchType: 'topic',
              session,
              summary: trimSearchSnippet(topic.title),
              topicId: topic.id,
            });
          }

          for (const message of messages as MessageSearchResult[]) {
            const session = sessionMap.get(message.sessionId);
            if (!session) continue;

            matches.push({
              id: `message-${message.id}`,
              matchedAt: message.createdAt,
              matchType: 'message',
              messageId: message.id,
              session,
              summary: trimSearchSnippet(message.content),
              topicId: message.topicId,
            });
          }

          matches.sort((left, right) => {
            const leftTs = left.matchedAt ? new Date(left.matchedAt).getTime() : 0;
            const rightTs = right.matchedAt ? new Date(right.matchedAt).getTime() : 0;
            return rightTs - leftTs;
          });

          setSearchResults(matches);
        })
        .catch(() => {
          if (!isCancelled) {
            toast.show('error', t.errorNetwork);
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setSearching(false);
          }
        });
    }, 260);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchText, sessions, t.chatListNewConversation, t.errorNetwork, toast]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchSessions(), fetchTags(), ensureInboxSession()]);
      haptics.success();
    } catch {
      toast.show('error', t.errorNetwork);
    }
    setRefreshing(false);
  }, [ensureInboxSession, fetchTags, fetchSessions, toast, t]);

  const createQuickChatSession = useCallback(
    async (options?: {
      includeComposerConfig?: boolean;
      model?: string;
      plugins?: string[];
      provider?: string;
    }) => {
      const session = await ensureInboxSession(options);
      if (!session?.id) {
        throw new Error('failed to resolve inbox session');
      }

      return session.id;
    },
    [ensureInboxSession],
  );

  const createQuickTopic = useCallback(
    async (sessionId: string) => {
      try {
        return await topicApi.create(sessionId, t.chatListNewConversation);
      } catch {
        return null;
      }
    },
    [t.chatListNewConversation],
  );

  const handleCreateChat = async () => {
    setCreateMenuVisible(false);
    try {
      const nextPlugins = [...enabledSkills];
      const sessionId =
        draftSession?.id ??
        (await createQuickChatSession({
          includeComposerConfig: true,
          model: selectedModel || undefined,
          plugins: nextPlugins,
          provider: selectedProvider || undefined,
        }));
      const agentConfig = await agentApi.getConfigBySession(sessionId).catch(() => null);
      const configPayload = {
        chatConfig: {
          memory: { effort: memoryEffort, enabled: memoryEnabled },
          searchMode: webSearchEnabled ? 'on' : 'off',
        },
        model: selectedModel || undefined,
        plugins: nextPlugins,
        provider: selectedProvider || undefined,
      };

      if (agentConfig?.id) {
        await agentApi.updateConfig(agentConfig.id, configPayload).catch(() => {
          /* best-effort */
        });
      } else {
        await sessionApi.updateSessionConfig(sessionId, configPayload).catch(() => {
          /* best-effort */
        });
      }

      const topicId = await createQuickTopic(sessionId);
      haptics.success();
      navigation.navigate('ChatDetail', topicId ? { sessionId, topicId } : { sessionId });
    } catch {
      toast.show('error', t.errorNetwork);
    }
  };

  const handleHeroSubmit = useCallback(async () => {
    const prompt = heroText.trim();
    const hasAttachment = pendingFiles.length > 0;
    if (!prompt && !hasAttachment) return;

    try {
      const nextPlugins = [...enabledSkills];
      const sessionId =
        draftSession?.id ??
        (await createQuickChatSession({
          includeComposerConfig: true,
          model: selectedModel || undefined,
          plugins: nextPlugins,
          provider: selectedProvider || undefined,
        }));
      const topicId = await createQuickTopic(sessionId);

      const agentConfig = await agentApi.getConfigBySession(sessionId).catch(() => null);
      const configPayload = {
        chatConfig: {
          memory: { effort: memoryEffort, enabled: memoryEnabled },
          searchMode: webSearchEnabled ? 'on' : 'off',
        },
        model: selectedModel || undefined,
        plugins: nextPlugins,
        provider: selectedProvider || undefined,
      };

      if (agentConfig?.id) {
        await agentApi.updateConfig(agentConfig.id, configPayload).catch(() => {
          /* best-effort */
        });
      } else {
        await sessionApi.updateSessionConfig(sessionId, configPayload).catch(() => {
          /* best-effort */
        });
      }

      void sendMessage(sessionId, prompt, topicId ?? undefined, {
        memoryEffort,
        memoryEnabled,
        plugins: nextPlugins.length > 0 ? nextPlugins : undefined,
        searchEnabled: webSearchEnabled,
      });

      setHeroText('');
      setDirectoryVisible(false);
      navigation.navigate('ChatDetail', topicId ? { sessionId, topicId } : { sessionId });
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [
    createQuickChatSession,
    createQuickTopic,
    draftSession?.id,
    enabledSkills,
    heroText,
    memoryEffort,
    memoryEnabled,
    navigation,
    pendingFiles.length,
    selectedModel,
    selectedProvider,
    sendMessage,
    t.errorNetwork,
    toast,
    webSearchEnabled,
  ]);

  const handleModelPress = useCallback(() => {
    haptics.light();
    setModelDrawerVisible(true);
  }, []);

  const handleToggleWebSearch = useCallback(() => {
    haptics.light();
    setWebSearchEnabled((value) => !value);
  }, []);

  const handleToggleMemory = useCallback(() => {
    haptics.light();
    setMemorySheetVisible(true);
  }, []);

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
                allowsMultipleSelection: true,
                mediaTypes: 'images',
                quality: 0.8,
              });

        if (result.canceled) return;

        for (const asset of result.assets) {
          addFile({
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: asset.fileName || 'image.jpg',
            size: asset.fileSize || 0,
            type: asset.mimeType || 'image/jpeg',
            uri: asset.uri,
          });
        }
      } catch {
        /* ignore */
      }
    },
    [addFile],
  );

  const pickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) return;

      for (const asset of result.assets) {
        addFile({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: asset.name,
          size: asset.size || 0,
          type: asset.mimeType || 'application/octet-stream',
          uri: asset.uri,
        });
      }
    } catch {
      /* ignore */
    }
  }, [addFile]);

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

  const handlePluginsPress = useCallback(() => {
    haptics.light();
    setSkillsVisible(true);
    setLoadingSkills(true);

    const preloadBuiltins = MOBILE_RECOMMENDED_BUILTIN_SKILLS.map((item) => ({
      description: (t as any)[item.descriptionKey] ?? '',
      icon: item.icon,
      identifier: item.identifier,
      title: (t as any)[item.titleKey] ?? item.identifier,
    }));
    setBuiltinSkillItems(preloadBuiltins);

    const loadSkills = async () => {
      try {
        const [plugins, skills, userState] = await Promise.all([
          pluginApi.list().catch(() => []),
          agentSkillApi.list().catch(() => []),
          userApi.getState().catch(() => null),
        ]);
        const uninstalled = userState?.settings?.tool?.uninstalledBuiltinTools ?? [];
        const builtins = MOBILE_RECOMMENDED_BUILTIN_SKILLS.filter(
          (item) => !uninstalled.includes(item.identifier),
        ).map((item) => ({
          description: (t as any)[item.descriptionKey] ?? '',
          icon: item.icon,
          identifier: item.identifier,
          title: (t as any)[item.titleKey] ?? item.identifier,
        }));

        setBuiltinSkillItems(builtins);

        const builtinIds = new Set(builtins.map((item) => item.identifier));
        const filteredSkills = (skills ?? []).filter((skill) => {
          const id = skill.identifier ?? skill.id;
          return Boolean(id) && !builtinIds.has(id);
        });
        const skillIds = new Set(filteredSkills.map((skill) => skill.identifier).filter(Boolean));
        const filteredPlugins = (plugins ?? []).filter(
          (plugin) => !builtinIds.has(plugin.identifier) && !skillIds.has(plugin.identifier),
        );

        setAgentSkillItems(filteredSkills);
        setInstalledPlugins(filteredPlugins);

        const availableIdentifiers = new Set([
          ...builtins.map((item) => item.identifier),
          ...filteredSkills.map((skill) => skill.identifier ?? skill.id),
          ...filteredPlugins.map((plugin) => plugin.identifier),
        ]);

        setEnabledSkills((current) => {
          const source = current.size > 0 ? [...current] : persistedSkillIdentifiers;
          return new Set(source.filter((identifier) => availableIdentifiers.has(identifier)));
        });
      } finally {
        setLoadingSkills(false);
      }
    };

    void loadSkills();
  }, [persistedSkillIdentifiers, t]);

  const handleToggleSkill = useCallback((identifier: string) => {
    haptics.light();
    setEnabledSkills((previous) => {
      const next = new Set(previous);
      if (next.has(identifier)) next.delete(identifier);
      else next.add(identifier);
      void saveSkillPickerSelection([...next]);
      return next;
    });
  }, []);

  const handleToggleSearch = useCallback(() => {
    haptics.light();
    setSearchEnabled((v) => {
      const next = !v;
      if (next) {
        setTimeout(() => searchInputRef.current?.focus(), 100);
      } else {
        setSearchText('');
      }
      return next;
    });
  }, []);

  const loadDraftSessionConfig = useCallback(
    async (sessionId: string | null) => {
      if (!sessionId) return;

      await loadSelection(sessionId);

      try {
        const config = await agentApi.getConfigBySession(sessionId);
        const configuredPlugins = Array.isArray(config?.plugins)
          ? config.plugins.filter(Boolean)
          : [];

        setEnabledSkills(
          new Set(
            configuredPlugins.length > 0 ? configuredPlugins : persistedSkillIdentifiers,
          ),
        );
        setWebSearchEnabled(config?.chatConfig?.searchMode === 'on');
        setMemoryEnabled(config?.chatConfig?.memory?.enabled !== false);
        setMemoryEffort(config?.chatConfig?.memory?.effort ?? 'medium');
      } catch {
        setEnabledSkills(new Set(persistedSkillIdentifiers));
        setWebSearchEnabled(false);
        setMemoryEnabled(true);
        setMemoryEffort('medium');
      }
    },
    [loadSelection, persistedSkillIdentifiers],
  );

  useEffect(() => {
    if (!draftSession?.id) return;
    void loadDraftSessionConfig(draftSession.id);
  }, [draftSession?.id, loadDraftSessionConfig]);

  const closeActionSheet = useCallback(() => {
    setActionPanel('root');
    setActionSession(null);
  }, []);

  const isInboxSession = useCallback(
    (session?: ChatSession | null) => !!session && session.id === inboxSession?.id,
    [inboxSession?.id],
  );

  const handleLongPress = useCallback((session: ChatSession) => {
    haptics.medium();
    setActionPanel('root');
    setActionSession(session);
  }, []);

  const handleRename = useCallback(
    (session: ChatSession) => {
      closeActionSheet();
      setRenameTarget(session);
      setTimeout(() => setRenameModalVisible(true), 300);
    },
    [closeActionSheet],
  );

  /** sessionId -> latest topic (from recentTopics) for session preview/tag filter */
  const latestTopicBySessionId = useMemo(() => {
    const map = new Map<
      string,
      { tagId?: string | null; title: string; topicId: string; updatedAt: string }
    >();
    for (const topic of recentTopics) {
      const sid = topic.sessionId;
      if (!sid) continue;
      const existing = map.get(sid);
      const ts =
        typeof topic.updatedAt === 'string'
          ? topic.updatedAt
          : ((topic.updatedAt as Date)?.toISOString?.() ?? '');
      if (!existing || new Date(ts).getTime() > new Date(existing.updatedAt).getTime()) {
        map.set(sid, {
          tagId: topic.tagId ?? null,
          title: topic.title ?? '',
          topicId: topic.id,
          updatedAt: ts,
        });
      }
    }
    return map;
  }, [recentTopics]);

  const handleMoveTopicToTag = useCallback(
    async (topicId: string, sessionId: string, tagId?: string | null) => {
      try {
        await updateTopicTag(topicId, sessionId, tagId);
        await refreshRecentTopics();
        haptics.success();
        setTopicTagTarget(null);
      } catch (err) {
        const { messageKey, type } = classifyError(err);
        toast.show('error', t[messageKey], {
          onRetry: type === 'auth' ? navigateToLogin : undefined,
          retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
        });
      }
    },
    [refreshRecentTopics, t, toast, updateTopicTag],
  );

  const { pinnedSessions, filteredSessions } = useMemo(() => {
    const pinned = visibleSessions.filter((session) => session.pinned);
    const rest = visibleSessions.filter((session) => !session.pinned);
    return { pinnedSessions: pinned, filteredSessions: rest };
  }, [visibleSessions]);

  useEffect(() => {
    if (draftAgentSessions.length === 0) return;

    const hasSelectedDraft =
      draftSessionId && draftAgentSessions.some((session) => session.id === draftSessionId);

    if (!hasSelectedDraft) {
      setDraftSessionId(draftAgentSessions[0].id);
    }
  }, [draftAgentSessions, draftSessionId]);

  useEffect(() => {
    setExpandedSessionIds((current) => {
      const next = new Set(current);
      let changed = false;

      for (const session of visibleSessions) {
        if (!next.has(session.id)) {
          next.add(session.id);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [visibleSessions]);

  const filteredSearchResults = searchResults;

  const handleCreateGroup = useCallback(async () => {
    setCreateMenuVisible(false);
    setCreateGroupSheetVisible(true);
  }, []);

  const handleCreateGroupSubmit = useCallback(
    async ({
      agentIds,
      supervisorConfig,
      title,
    }: {
      agentIds: string[];
      supervisorConfig?: { model?: string; provider?: string };
      title: string;
    }) => {
      try {
        const nextTitle = title.trim() || t.groupCreateDefaultTitle;
        const result = await agentGroupApi.createGroup({
          supervisorConfig,
          title: nextTitle,
        });
        if (!result?.group?.id) {
          toast.show('error', t.errorNetwork);
          return;
        }

        if (agentIds.length > 0) {
          await agentGroupApi.addAgentsToGroup(result.group.id, agentIds);
        }

        setCreateGroupSheetVisible(false);
        setDirectoryVisible(false);
        await fetchSessions();
        haptics.success();
        // Align with web: empty group → config page; group with members → chat page
        if (agentIds.length === 0) {
          navigation.navigate('ChatSettings', { sessionId: result.group.id });
        } else {
          navigation.navigate('ChatDetail', { sessionId: result.group.id });
        }
      } catch {
        toast.show('error', t.errorNetwork);
      }
    },
    [fetchSessions, navigation, t.errorNetwork, t.groupCreateDefaultTitle, toast],
  );

  const renderTagChip = useCallback(
    (tagId?: string) => {
      if (!tagId) return null;

      const tag = tagById[tagId];
      if (!tag) return null;

      return (
        <View
          className="ml-2 flex-row items-center rounded-full px-2.5 py-0.5"
          style={{ backgroundColor: withAlpha(tag.color, '18') }}
        >
          <View
            className="mr-1.5 rounded-full"
            style={{ backgroundColor: resolveTagColor(tag.color), height: 6, width: 6 }}
          />
          <Text
            className="text-[10px] font-semibold"
            numberOfLines={1}
            style={{ color: resolveTagColor(tag.color) }}
          >
            {tag.name}
          </Text>
        </View>
      );
    },
    [tagById],
  );

  /** Virtual "群聊" tag for group chat topics (no DB, display only). */
  const renderGroupTagChip = useCallback(
    () => (
      <View
        className="ml-2 flex-row items-center rounded-full px-2.5 py-0.5"
        style={{ backgroundColor: withAlpha(colors.primary, '18') }}
      >
        <View
          className="mr-1.5 rounded-full"
          style={{ backgroundColor: colors.primary, height: 6, width: 6 }}
        />
        <Text
          className="text-[10px] font-semibold"
          numberOfLines={1}
          style={{ color: colors.primary }}
        >
          {t.chatListGroupTag}
        </Text>
      </View>
    ),
    [colors.primary, t.chatListGroupTag],
  );

  const closeTopicActionSheet = useCallback(() => setTopicActionTarget(null), []);

  const handleTopicDeleteWithAlert = useCallback(
    (topicId: string, sessionId: string, onAfterDelete?: () => void) => {
      closeTopicActionSheet();
      setTimeout(() => {
        Alert.alert(t.deleteTopicConfirm, t.deleteTopicDesc, [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.delete,
            style: 'destructive',
            onPress: () => {
              haptics.warning();
              void removeTopic(topicId, sessionId).then(() => onAfterDelete?.());
            },
          },
        ]);
      }, 300);
    },
    [closeTopicActionSheet, removeTopic, t],
  );

  const handleTopicRename = useCallback(
    async (topicId: string, sessionId: string, newTitle: string) => {
      await updateTopic(topicId, sessionId, newTitle);
      haptics.success();
      useToast.getState().show('success', t.topicRenamed);
      refreshRecentTopics();
    },
    [refreshRecentTopics, t.topicRenamed, updateTopic],
  );

  const [smartRenamingTopicId, setSmartRenamingTopicId] = useState<string | null>(null);
  const handleTopicSmartRename = useCallback(
    async (topicId: string, sessionId: string) => {
      if (smartRenamingTopicId) return;
      haptics.light();
      setSmartRenamingTopicId(topicId);
      const t18n = useI18n.getState().t;
      const failMsg = [
        t18n.toastTitleGenerationFailed || 'Failed to generate title',
        t18n.toastTitleGenerationFailedHint || '',
      ]
        .filter(Boolean)
        .join(' ');
      try {
        const result = await generateBestTitle({ sessionId, topicId });
        if (result?.title) {
          useToast
            .getState()
            .show('success', result.target === 'topic' ? t18n.topicRenamed : t18n.sessionRenamed);
          refreshRecentTopics();
        } else {
          useToast.getState().show('error', failMsg);
        }
      } catch {
        useToast.getState().show('error', failMsg);
      } finally {
        setSmartRenamingTopicId(null);
      }
    },
    [refreshRecentTopics, smartRenamingTopicId],
  );

  const toggleAssistantExpand = useCallback((sessionId: string) => {
    haptics.light();
    setExpandedSessionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
        void fetchTopics(sessionId);
      }
      return next;
    });
  }, [fetchTopics]);

  const renderAssistantRow = (item: ChatSession, showTopicPreview?: boolean) => {
    const itemIsInbox = isInboxSession(item);
    const providerId =
      item.provider || (item.model ? inferProviderFromModelId(item.model) : undefined);
    const isExpanded = expandedSessionIds.has(item.id);
    const topics = topicsBySession[item.id] ?? [];
    return (
      <View key={item.id}>
        <View className="flex-row items-center bg-background">
          <TouchableOpacity
            accessibilityLabel={item.title}
            accessibilityRole="button"
            activeOpacity={0.4}
            className="flex-1 flex-row items-start px-5 py-3 active:bg-foreground/10"
            onLongPress={() => handleLongPress(item)}
            onPress={() => toggleAssistantExpand(item.id)}
          >
            <View className="w-10 h-10 rounded-full items-center justify-center mr-3.5 mt-0.5">
              <SessionLogo
                avatar={item.avatar}
                isInbox={itemIsInbox}
                isGroup={item.type === 'group'}
                provider={providerId}
                size={36}
              />
            </View>
            <View className="flex-1 mr-3 mt-0.5">
              <View className="flex-row items-center mb-0.5 flex-wrap">
                {item.pinned && (
                  <Pin
                    color={colors.primary}
                    size={11}
                    strokeWidth={tokens.icon.strokeWidth}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  className="text-foreground text-[15px] font-medium tracking-tight"
                  numberOfLines={1}
                >
                  {item.title || t.chatListNewConversation}
                </Text>
              </View>
              <Text className="text-[12px] font-medium" numberOfLines={1} style={{ color: colors.secondaryText }}>
                {showTopicPreview
                  ? (() => {
                      const latest = latestTopicBySessionId.get(item.id);
                      if (latest?.title)
                        return `${t.topicTitle}: ${latest.title} · ${formatTimeAgo(latest.updatedAt, t)}`;
                      if (itemIsInbox) return item.description || '';
                      return item.description ?? '';
                    })()
                  : (item.description ?? '')}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel={isExpanded ? t.chatListCollapseAssistant : t.chatListExpandAssistant}
            accessibilityRole="button"
            activeOpacity={0.7}
            className="px-4 py-3"
            onPress={(e) => {
              e.stopPropagation();
              toggleAssistantExpand(item.id);
            }}
          >
            {isExpanded ? (
              <ChevronUp color={colors.secondaryText} size={20} strokeWidth={tokens.icon.strokeWidth} />
            ) : (
              <ChevronDown color={colors.secondaryText} size={20} strokeWidth={tokens.icon.strokeWidth} />
            )}
          </TouchableOpacity>
        </View>
        {isExpanded && topics.length > 0 && (
          <View className="pl-5 pr-2 pb-2" style={{ paddingLeft: 20 + 36 + 14 }}>
            {topics.map((topic: Topic) => (
              <TouchableOpacity
                accessibilityLabel={topic.title}
                accessibilityRole="button"
                activeOpacity={0.65}
                className="flex-row items-center rounded-lg px-3 py-2.5 active:bg-foreground/5"
                key={topic.id}
                onLongPress={() => {
                  haptics.medium();
                      setTopicActionTarget({
                        sessionId: item.id,
                        topicId: topic.id,
                        topicTagId: topic.tagId ?? null,
                        topicTitle: topic.title ?? '',
                        topicType: item.type,
                      });
                }}
                onPress={() =>
                  {
                    setDirectoryVisible(false);
                    navigation.navigate('ChatDetail', {
                      sessionId: item.id,
                      topicId: topic.id,
                    });
                  }
                }
              >
                <Text
                  className="flex-1 text-[14px] font-medium"
                  numberOfLines={1}
                  style={{ color: colors.foreground }}
                >
                  {topic.title || t.chatListNewConversation}
                </Text>
                {item.type === 'group' && renderGroupTagChip()}
                {renderTagChip(topic.tagId ?? undefined)}
                <Text className="text-[11px] font-medium" style={{ color: colors.secondaryText }}>
                  {formatTimeAgo(topic.updatedAt, t)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {isExpanded && topics.length === 0 && (
          <View className="px-5 pb-3" style={{ paddingLeft: 20 + 36 + 14 }}>
            <Text className="text-[13px]" style={{ color: colors.secondaryText }}>
              {t.chatListTopicEmpty}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderSearchResultRow = ({
    id,
    matchType,
    messageId,
    session,
    summary,
    topicId,
  }: SearchSessionResult) => {
    const providerId =
      session.provider || (session.model ? inferProviderFromModelId(session.model) : undefined);
    const topicTagId =
      (topicId
        ? (topicsBySession[session.id] ?? []).find((topic) => topic.id === topicId)?.tagId
        : undefined) ?? latestTopicBySessionId.get(session.id)?.tagId;

    return (
      <TouchableOpacity
        accessibilityLabel={`${session.title || t.chatListNewConversation}, ${matchType === 'session' ? t.chatSearchMatchSession : matchType === 'topic' ? t.chatSearchMatchTopic : t.chatSearchMatchMessage}`}
        accessibilityRole="button"
        activeOpacity={0.65}
        className="flex-row items-start px-5 py-3"
        key={id}
        onPress={() => {
          setDirectoryVisible(false);
          navigation.navigate('ChatDetail', {
            messageId,
            sessionId: session.id,
            ...(topicId ? { topicId } : {}),
          });
        }}
      >
        <View className="mr-3.5 mt-0.5 h-10 w-10 items-center justify-center rounded-full">
          <SessionLogo
            avatar={session.avatar}
            isInbox={isInboxSession(session)}
            isGroup={session.type === 'group'}
            provider={providerId}
            size={36}
          />
        </View>
        <View className="flex-1">
          <View className="mb-1 flex-row items-center flex-wrap">
            <Text
              className="text-[15px] font-medium tracking-tight text-foreground"
              numberOfLines={1}
            >
              {session.title || t.chatListNewConversation}
            </Text>
            <Text
              className="ml-2 text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: colors.secondaryText }}
            >
              {matchType === 'session'
                ? t.chatSearchMatchSession
                : matchType === 'topic'
                  ? t.chatSearchMatchTopic
                  : t.chatSearchMatchMessage}
            </Text>
            {renderTagChip(topicTagId ?? undefined)}
          </View>
          <Text className="text-[12px] font-medium leading-5" numberOfLines={2} style={{ color: colors.secondaryText }}>
            {summary}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const searchQuery = searchText.trim();
  const homeSuggestions = [t.chatSuggest1, t.chatSuggest2, t.chatSuggest3, t.chatSuggest4];
  const actionSessionIsGroup = actionSession?.type === 'group';
  const actionSessionIsInbox = isInboxSession(actionSession);
  const drawerBackdropStyle = useAnimatedStyle(() => ({
    opacity: drawerBackdropOpacity.value,
  }));
  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: drawerTranslateX.value }],
  }));
  const drawerGesture = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onUpdate((event) => {
      const nextX = Math.min(0, Math.max(-DIRECTORY_DRAWER_WIDTH, event.translationX));
      drawerTranslateX.value = nextX;
      drawerBackdropOpacity.value = 1 + nextX / DIRECTORY_DRAWER_WIDTH;
    })
    .onEnd((event) => {
      const shouldClose =
        event.translationX < -DIRECTORY_DRAWER_WIDTH * 0.24 || event.velocityX < -700;

      if (shouldClose) {
        runOnJS(setDirectoryVisible)(false);
        return;
      }

      drawerTranslateX.value = withTiming(0, { duration: 180 });
      drawerBackdropOpacity.value = withTiming(1, { duration: 180 });
    });

  const openDrawerGesture = Gesture.Pan()
    .enabled(!directoryMounted)
    .activeOffsetX([16, 999])
    .failOffsetY([-18, 18])
    .onEnd((event) => {
      const shouldOpen = event.translationX > 80 || event.velocityX > 720;

      if (shouldOpen) {
        runOnJS(setDirectoryVisible)(true);
      }
    });

  return (
    <View className="flex-1 bg-background">
      {!directoryMounted ? (
        <GestureDetector gesture={openDrawerGesture}>
          <View
            pointerEvents="box-only"
            style={{
              bottom: 0,
              left: 0,
              position: 'absolute',
              top: 0,
              width: 24,
              zIndex: 30,
            }}
          />
        </GestureDetector>
      ) : null}
      <BlurView
        className="z-10"
        intensity={90}
        style={{ paddingTop: insets.top }}
        tint={effectiveTheme === 'dark' ? 'dark' : 'light'}
      >
        <View className="flex-row items-center justify-between px-4 py-2.5">
          <View className="flex-row items-center flex-1">
            <PressableScale
              accessibilityLabel={t.accessibilityChatDirectory}
              accessibilityRole="button"
              className="w-9 h-9 items-center justify-center rounded-full mr-2"
              onPress={() => {
                haptics.light();
                setDirectoryVisible(true);
              }}
            >
              <Menu
                color={directoryVisible ? colors.primary : colors.foreground}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </PressableScale>
            <PressableScale
              accessibilityLabel={t.chatListAssistants}
              accessibilityRole="button"
              className="flex-1 rounded-2xl px-2 py-1.5"
              onPress={() => {
                haptics.light();
                setDraftAssistantPickerVisible(true);
              }}
            >
              <View className="flex-row items-center">
                <View className="mr-3">
                  <SessionLogo
                    avatar={draftSessionIsInbox ? (draftSession?.avatar || DEFAULT_INBOX_AVATAR) : draftSession?.avatar}
                    isInbox={draftSessionIsInbox}
                    provider={
                      draftSessionIsInbox
                        ? undefined
                        : draftSession?.provider ||
                          (draftSession?.model
                            ? inferProviderFromModelId(draftSession.model)
                            : undefined) ||
                          selectedProvider ||
                          undefined
                    }
                    providerLogo={draftSessionIsInbox ? undefined : toolbarProviderLogo}
                    size={34}
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className="text-[16px] font-medium text-foreground tracking-tight"
                    numberOfLines={1}
                  >
                    {draftSession?.title || 'Avato'}
                  </Text>
                  {selectedModel ? (
                    <View className="mt-0.5 flex-row items-center">
                      <Text
                        className="flex-1 text-[12px] font-medium"
                        numberOfLines={1}
                        style={{ color: colors.muted }}
                      >
                        {selectedModel}
                      </Text>
                    </View>
                  ) : null}
                </View>
                <ChevronDown
                  color={colors.secondaryText}
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginLeft: 8 }}
                />
              </View>
            </PressableScale>
          </View>
        </View>
      </BlurView>

      <View className="flex-1">
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingBottom: insets.bottom + 116,
            paddingTop: 12,
          }}
          refreshControl={
            <RefreshControl
              colors={[colors.primary]}
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={onRefresh}
            />
          }
        >
          <View
            style={{
              justifyContent: 'center',
              minHeight: Dimensions.get('window').height * 0.5,
            }}
          >
            {sessionErrorMessage ? (
              <Animated.View entering={FadeInDown.delay(180).duration(320)}>
                <View className="px-5 pt-4">
                  <View
                    className="rounded-2xl px-4 py-4"
                    style={{ backgroundColor: colors.fillTertiary }}
                  >
                    <Text className="text-[14px] font-semibold text-foreground">
                      {sessionErrorMessage}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      className="mt-3 rounded-full self-start px-4 py-2"
                      style={{ backgroundColor: colors.primary }}
                      onPress={() => void onRefresh()}
                    >
                      <Text className="text-[13px] font-semibold text-white">{t.errorRetry}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            ) : (
              <Animated.View entering={FadeInDown.delay(80).duration(320)}>
                <EmptyState
                  description={t.chatEmptyDesc}
                  iconVariant="chat"
                  title={t.chatEmptyWave}
                  action={
                    <Animated.View
                      className="flex-row flex-wrap justify-center gap-2 mt-4 px-6"
                      entering={FadeInDown.delay(200).duration(350)}
                    >
                      {homeSuggestions.map((label) => (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          className="px-4 py-2.5 rounded-full bg-foreground/[0.03]"
                          key={label}
                          onPress={() => {
                            haptics.light();
                            setHeroText(label);
                          }}
                        >
                          <Text className="text-secondary text-[13px] font-medium">{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </Animated.View>
                  }
                />
                {streak > 1 ? (
                  <Text className="pt-6 text-center text-[13px] font-medium text-secondary/60">
                    {streak >= 7 ? '🔥 ' : ''}
                    {t.streakMessage.replace('{count}', String(streak))}
                  </Text>
                ) : null}
              </Animated.View>
            )}
          </View>
        </ScrollView>

        <Animated.View
          style={{
            paddingBottom: Math.max(insets.bottom, 8),
            paddingHorizontal: 16,
            paddingTop: 4,
            transform: [{ translateY: -keyboardOffset }],
          }}
        >
          <BlurView
            className="rounded-2xl overflow-hidden"
            intensity={80}
            tint={effectiveTheme === 'dark' ? 'dark' : 'light'}
            style={{
              backgroundColor: colors.overlay,
              borderColor: keyboardOffset > 0 ? colors.primary : colors.primaryBorder,
              borderWidth: keyboardOffset > 0 ? 3 : 1,
            }}
          >
            {pendingFiles.length > 0 && (
              <View className="px-3 pt-2">
                <FilePreview />
              </View>
            )}
            <View className="px-3 pt-2">
              <TextInput
                multiline
                accessibilityLabel={hints[hintIndex]}
                className="text-foreground text-[16px] leading-[22px] min-h-[36px] max-h-28"
                placeholder={hints[hintIndex]}
                placeholderTextColor={colors.secondaryText}
                style={{ paddingVertical: 0, textAlignVertical: 'top' }}
                underlineColorAndroid="transparent"
                value={heroText}
                onChangeText={setHeroText}
              />
            </View>
            <View className="flex-row items-center px-2 pb-1.5 pt-1">
              <TouchableOpacity
                accessibilityLabel="Select model"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full"
                onPress={handleModelPress}
              >
                {toolbarProviderLogo && !providerLogoError ? (
                  <RNImage
                    source={{ uri: toolbarProviderLogo }}
                    style={{ width: 20, height: 20, borderRadius: 4 }}
                    onError={() => setProviderLogoError(true)}
                  />
                ) : (
                  <Cpu color={colors.secondaryText} size={20} strokeWidth={tokens.icon.strokeWidth} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Toggle search"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                onPress={handleToggleWebSearch}
              >
                <Globe
                  color={webSearchEnabled ? colors.primary : colors.muted}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Attach file"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                onPress={handleAttach}
              >
                <View className="relative items-center justify-center">
                  <Paperclip
                    color={pendingFiles.length > 0 ? colors.primary : colors.muted}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  {pendingFiles.length > 0 && (
                    <View
                      className="absolute -right-2 -top-1 rounded-full items-center justify-center"
                      style={{
                        backgroundColor: colors.primary,
                        minWidth: 14,
                        height: 14,
                        paddingHorizontal: 3,
                      }}
                    >
                      <Text
                        className="text-[9px] font-semibold"
                        style={{ color: colors.iconOnPrimary }}
                      >
                        {pendingFiles.length > 9 ? '9+' : pendingFiles.length}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Toggle tools"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                onPress={handlePluginsPress}
              >
                <Puzzle
                  color={enabledSkills.size > 0 ? colors.primary : colors.muted}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityLabel="Toggle memory"
                activeOpacity={0.7}
                className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
                onPress={handleToggleMemory}
              >
                {memoryEnabled ? (
                  <BrainCircuit
                    color={colors.primary}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                ) : (
                  <Brain color={colors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
                )}
              </TouchableOpacity>
              <View className="flex-1" />
              {heroText.trim() || pendingFiles.length > 0 ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  className="w-9 h-9 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.primary }}
                  onPress={handleHeroSubmit}
                >
                  <Send
                    color={colors.iconOnPrimary}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                    style={{ marginLeft: 1 }}
                  />
                </TouchableOpacity>
              ) : (
                <View className="w-9 h-9" />
              )}
            </View>
          </BlurView>
        </Animated.View>
      </View>

      <Modal
        transparent
        animationType="none"
        visible={directoryMounted}
        onRequestClose={() => setDirectoryVisible(false)}
      >
        <View className="flex-1">
          <Animated.View
            className="bg-black/30"
            style={[{ bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 }, drawerBackdropStyle]}
          >
            <Pressable className="flex-1" onPress={() => setDirectoryVisible(false)} />
          </Animated.View>
          <GestureDetector gesture={drawerGesture}>
            <Animated.View
              className="h-full bg-background"
              style={[{ paddingTop: insets.top, width: DIRECTORY_DRAWER_WIDTH }, drawerStyle]}
            >
            <View className="flex-row items-center justify-between px-5 py-4">
              <View className="flex-row items-center">
                <MessageCircle color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-2 text-[18px] font-semibold text-foreground">
                  {t.tabChats}
                </Text>
              </View>
              <View className="flex-row items-center" style={{ gap: 10 }}>
                <TouchableOpacity
                  accessibilityLabel={t.chatListSearch}
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  className="h-10 w-10 items-center justify-center"
                  onPress={handleToggleSearch}
                >
                  <Search
                    color={searchEnabled ? colors.primary : colors.secondaryText}
                    size={20}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  accessibilityLabel={t.cancel}
                  accessibilityRole="button"
                  activeOpacity={0.7}
                  className="h-10 w-10 items-center justify-center"
                  onPress={() => setDirectoryVisible(false)}
                >
                  <X color={colors.secondaryText} size={20} strokeWidth={tokens.icon.strokeWidth} />
                </TouchableOpacity>
              </View>
            </View>

            {searchEnabled ? (
              <Animated.View className="px-5 pb-3" entering={FadeInDown.duration(220)}>
                <View className="flex-row items-center rounded-xl bg-foreground/5 px-3.5 py-2.5">
                  <Search color={colors.secondaryText} size={16} strokeWidth={tokens.icon.strokeWidth} />
                  <TextInput
                    className="ml-2.5 flex-1 text-[14px] text-foreground"
                    clearButtonMode="while-editing"
                    placeholder={t.chatListSearch}
                    placeholderTextColor={colors.secondaryText}
                    ref={searchInputRef}
                    returnKeyType="search"
                    value={searchText}
                    onChangeText={setSearchText}
                  />
                  <TouchableOpacity
                    accessibilityLabel={t.cancel}
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => {
                      haptics.light();
                      setSearchEnabled(false);
                      setSearchText('');
                    }}
                  >
                    <X color={colors.secondaryText} size={18} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ) : null}

            <ScrollView
              className="flex-1"
              contentContainerStyle={{ paddingBottom: insets.bottom + 104 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {searchQuery ? (
                searching ? (
                  <View className="px-5 pt-6">
                    <Text className="text-center text-[14px] font-medium text-secondary/55">
                      {t.chatSearchSearching}
                    </Text>
                  </View>
                ) : filteredSearchResults.length > 0 ? (
                  <SectionBlock title={t.chatSearchResults}>
                    {filteredSearchResults.map(renderSearchResultRow)}
                  </SectionBlock>
                ) : (
                  <View className="px-5 pt-6">
                    <Text className="text-center text-[14px] font-medium text-secondary/55">
                      {t.chatSearchNoResults}
                    </Text>
                  </View>
                )
              ) : (
                <>
                  {pinnedSessions.length > 0 ? (
                    <SectionBlock title={t.groupPinned}>
                      {pinnedSessions.map((session) => renderAssistantRow(session, true))}
                    </SectionBlock>
                  ) : null}

                  {(filteredSessions.length > 0 || visibleInboxSession) ? (
                    <SectionBlock title={t.homeRecents}>
                      {visibleInboxSession ? renderAssistantRow(visibleInboxSession, true) : null}
                      {filteredSessions.slice(0, 20).map((session) =>
                        renderAssistantRow(session, true),
                      )}
                    </SectionBlock>
                  ) : null}

                  {loading && visibleSessions.length === 0 && !visibleInboxSession ? (
                    <ListSkeleton />
                  ) : null}
                </>
              )}
            </ScrollView>

            <View className="px-5 pb-5">
              <TouchableOpacity
                accessibilityLabel={t.accessibilityCreateMenu}
                accessibilityRole="button"
                activeOpacity={0.78}
                className="flex-row items-center justify-center rounded-2xl border border-dashed px-4 py-4"
                style={{ borderColor: colors.border }}
                onPress={() => {
                  haptics.light();
                  setCreateMenuVisible(true);
                }}
              >
                <Plus color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-2 text-[15px] font-semibold" style={{ color: colors.primary }}>
                  {t.accessibilityCreateMenu}
                </Text>
              </TouchableOpacity>
            </View>
            </Animated.View>
          </GestureDetector>
        </View>
      </Modal>

      <Modal
        accessibilityViewIsModal
        transparent
        animationType="fade"
        visible={createMenuVisible}
        onRequestClose={() => setCreateMenuVisible(false)}
      >
        <Pressable className="flex-1 bg-black/10" onPress={() => setCreateMenuVisible(false)}>
          <Pressable
            className="absolute overflow-hidden rounded-xl bg-card"
            style={{
              bottom: insets.bottom + 96,
              minWidth: 220,
              right: 16,
            }}
            onPress={(event) => event.stopPropagation()}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center px-4 py-3"
              onPress={handleCreateChat}
            >
              <MessageSquarePlus
                color={colors.primary}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
              <Text className="ml-3 text-[15px] font-medium text-foreground">
                {t.topicCreate}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center px-4 py-3"
              onPress={handleCreateGroup}
            >
              <UsersRound color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-[15px] font-medium text-foreground">
                {t.chatListCreateGroup}
              </Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <AgentSelectionSheet
        allowEmptySelection
        showSupervisorModelPicker
        showTitleInput
        confirmLabel={t.done}
        initialTitle={t.groupCreateDefaultTitle}
        title={t.chatListCreateGroup}
        titleInputLabel={t.agentConfigName}
        titleInputPlaceholder={t.groupCreateDefaultTitle}
        visible={createGroupSheetVisible}
        onClose={() => setCreateGroupSheetVisible(false)}
        onSubmit={handleCreateGroupSubmit}
      />

      <ModelDrawer
        visible={modelDrawerVisible}
        onClose={() => setModelDrawerVisible(false)}
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
        visible={memorySheetVisible}
        onChangeEffort={setMemoryEffort}
        onChangeEnabled={setMemoryEnabled}
        onClose={() => setMemorySheetVisible(false)}
      />
      <SkillsSheet
        agentConfigOpenStore={t.agentConfigOpenStore}
        agentSkillItems={agentSkillItems}
        builtinItems={builtinSkillItems}
        enabledIdentifiers={enabledSkills}
        installedPlugins={installedPlugins}
        loading={loadingSkills}
        skillsEmpty={t.skillsEmpty}
        skillsEmptyDesc={t.skillsEmptyDesc}
        skillsTitle={t.skillsTitle}
        visible={skillsVisible}
        onClose={() => setSkillsVisible(false)}
        onOpenStore={() => navigation.getParent()?.navigate('MainTabs', { screen: 'Store' })}
        onToggle={handleToggleSkill}
      />

      {/* Session Action Sheet */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={!!actionSession}
        onRequestClose={closeActionSheet}
      >
        <Pressable className="flex-1 justify-end bg-black/40" onPress={closeActionSheet}>
          <Pressable
            className="bg-card rounded-t-2xl overflow-hidden"
            style={{ maxHeight: '72%' }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <View style={{ paddingBottom: 32, position: 'relative' }}>
              <View className="px-5">
                {!actionSessionIsInbox ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      if (actionSession) {
                        haptics.light();
                        if (actionSession.pinned) {
                          unpinSession(actionSession.id);
                        } else {
                          pinSession(actionSession.id);
                        }
                      }
                      closeActionSheet();
                    }}
                  >
                    <Pin color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-foreground">
                      {actionSession?.pinned ? t.actionUnpin : t.actionPin}
                    </Text>
                  </Pressable>
                ) : null}

                {actionSession && !actionSessionIsGroup ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      closeActionSheet();
                      navigation.navigate('AgentConfig', { sessionId: actionSession.id });
                    }}
                  >
                    <Bot color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-foreground">{t.agentConfigTitle}</Text>
                  </Pressable>
                ) : null}

                {actionSessionIsGroup ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => actionSession && handleRename(actionSession)}
                  >
                    <Pencil color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-foreground">{t.actionRename}</Text>
                  </Pressable>
                ) : null}

                {!actionSessionIsInbox ? (
                  <Pressable
                    className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      if (!actionSession) return;

                      closeActionSheet();
                      Alert.alert(
                        actionSessionIsGroup ? t.deleteSessionConfirm : t.agentDeleteConfirm,
                        actionSessionIsGroup ? t.deleteSessionDesc : t.agentDeleteDesc,
                        [
                          { text: t.cancel, style: 'cancel' },
                          {
                            text: t.delete,
                            style: 'destructive',
                            onPress: () => {
                              haptics.warning();
                              removeSession(actionSession.id);
                            },
                          },
                        ],
                      );
                    }}
                  >
                    <Trash2 color={colors.danger} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    <Text className="ml-3 text-base text-red-500">{t.delete}</Text>
                  </Pressable>
                ) : null}
              </View>

              <View className="px-5 mt-2">
                <Pressable
                  className="items-center py-3.5 rounded-xl bg-foreground/[0.04]"
                  onPress={closeActionSheet}
                >
                  <Text className="text-base font-medium" style={{ color: colors.secondaryText }}>{t.cancel}</Text>
                </Pressable>
              </View>

            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <PromptModal
        defaultValue={renameModalVisible ? (renameTarget?.title ?? '') : ''}
        submitLabel={t.save}
        title={t.sessionRenameTitle}
        visible={renameModalVisible}
        onCancel={() => {
          setRenameModalVisible(false);
          setRenameTarget(null);
        }}
        onSubmit={(value) => {
          setRenameModalVisible(false);
          if (renameTarget) {
            haptics.success();
            renameSession(renameTarget.id, value);
          }
        }}
      />

      <PromptModal
        defaultValue={topicRenameTarget?.title ?? ''}
        placeholder={t.topicRenamePlaceholder}
        submitLabel={t.save}
        title={t.topicRename}
        visible={!!topicRenameTarget}
        onCancel={() => setTopicRenameTarget(null)}
        onSubmit={async (value) => {
          if (topicRenameTarget) {
            setTopicRenameTarget(null);
            await handleTopicRename(
              topicRenameTarget.topicId,
              topicRenameTarget.sessionId,
              value,
            );
          }
        }}
      />

      {/* Topic action sheet (long-press menu, same style as agent) */}
      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={!!topicActionTarget}
        onRequestClose={closeTopicActionSheet}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={closeTopicActionSheet}
        >
          <Pressable
            className="bg-card rounded-t-2xl pb-8"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <Text className="px-5 pb-3 text-[16px] font-semibold text-foreground" numberOfLines={1}>
              {topicActionTarget?.topicTitle || t.chatListNewConversation}
            </Text>
            <View className="px-5">
              <Pressable
                className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                onPress={() => {
                  if (topicActionTarget) {
                    closeTopicActionSheet();
                    void handleTopicSmartRename(topicActionTarget.topicId, topicActionTarget.sessionId);
                  }
                }}
              >
                <Wand2 color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-3 text-base text-foreground">{t.actionSmartRename}</Text>
              </Pressable>
              <Pressable
                className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                onPress={() => {
                  if (topicActionTarget) {
                    closeTopicActionSheet();
                    setTimeout(
                      () =>
                        setTopicRenameTarget({
                          sessionId: topicActionTarget.sessionId,
                          title: topicActionTarget.topicTitle ?? '',
                          topicId: topicActionTarget.topicId,
                        }),
                      300,
                    );
                  }
                }}
              >
                <Pencil color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-3 text-base text-foreground">{t.actionRename}</Text>
              </Pressable>
              {topicActionTarget && topicActionTarget.topicType !== 'group' ? (
                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={() => {
                    if (topicActionTarget) {
                      closeTopicActionSheet();
                      setTimeout(
                        () =>
                          setTopicTagTarget({
                            sessionId: topicActionTarget.sessionId,
                            topicId: topicActionTarget.topicId,
                            currentTagId: topicActionTarget.topicTagId ?? null,
                          }),
                        300,
                      );
                    }
                  }}
                >
                  <Tag color={colors.muted} size={18} strokeWidth={tokens.icon.strokeWidth} />
                  <Text className="ml-3 text-base text-foreground">{t.tagMoveSession}</Text>
                </Pressable>
              ) : null}
              <Pressable
                className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                onPress={() =>
                  topicActionTarget &&
                  handleTopicDeleteWithAlert(
                    topicActionTarget.topicId,
                    topicActionTarget.sessionId,
                    topicActionTarget.onAfterDelete,
                  )
                }
              >
                <Trash2 color={colors.danger} size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-3 text-base text-red-500">{t.delete}</Text>
              </Pressable>
            </View>
            <View className="px-5 mt-2">
              <Pressable
                className="items-center py-3.5 rounded-xl bg-foreground/[0.04]"
                onPress={closeTopicActionSheet}
              >
                <Text className="text-base font-medium" style={{ color: colors.secondaryText }}>
                  {t.cancel}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Topic tag picker modal (for non-group topics in Topics tab) */}
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
                  void handleMoveTopicToTag(
                    topicTagTarget.topicId,
                    topicTagTarget.sessionId,
                    null,
                  )
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
                  <Check
                    color={colors.primary}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
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
                    <Check
                      color={colors.primary}
                      size={18}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        accessibilityViewIsModal
        transparent
        animationType="slide"
        visible={draftAssistantPickerVisible}
        onRequestClose={() => setDraftAssistantPickerVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setDraftAssistantPickerVisible(false)}
        >
          <Pressable
            className="bg-card rounded-t-2xl"
            style={{ maxHeight: '72%', paddingBottom: insets.bottom + 16 }}
            onPress={(event) => event.stopPropagation()}
          >
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>
            <View className="flex-row items-center justify-between px-5 pb-3 pt-1">
              <Text className="text-[18px] font-semibold tracking-tight text-foreground">
                {t.chatListAssistants}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                className="h-10 w-10 items-center justify-center"
                onPress={() => setDraftAssistantPickerVisible(false)}
              >
                <X color={colors.secondaryText} size={20} strokeWidth={tokens.icon.strokeWidth} />
              </TouchableOpacity>
            </View>
            <ScrollView
              className="px-5"
              contentContainerStyle={{ paddingBottom: 16 }}
              keyboardShouldPersistTaps="handled"
            >
              {draftAgentSessions.map((session) => {
                const isSelected = draftSession?.id === session.id;
                const providerId =
                  session.provider ||
                  (session.model ? inferProviderFromModelId(session.model) : undefined);

                return (
                  <TouchableOpacity
                    activeOpacity={0.72}
                    className="mb-2 flex-row items-center rounded-2xl px-3 py-3"
                    key={session.id}
                    style={{
                      backgroundColor: isSelected ? withAlpha(colors.primary, '14') : colors.fillTertiary,
                    }}
                    onPress={() => {
                      haptics.light();
                      setDraftSessionId(session.id);
                      setDraftAssistantPickerVisible(false);
                    }}
                  >
                    <View className="mr-3">
                      <SessionLogo
                        avatar={session.avatar}
                        isInbox={session.id === visibleInboxSession?.id}
                        isGroup={false}
                        provider={providerId}
                        size={38}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                        {session.title || 'Avato'}
                      </Text>
                      <Text
                        className="mt-0.5 text-[12px]"
                        numberOfLines={1}
                        style={{ color: colors.secondaryText }}
                      >
                        {session.description || session.model || t.chatListTapToContinue}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Check color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

    </View>
  );
}
