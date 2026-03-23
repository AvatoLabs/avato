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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  FileText,
  MessageCircle,
  MessageSquarePlus,
  Pencil,
  Pin,
  Search,
  Tag,
  Trash2,
  UsersRound,
  Wand2,
  X,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedKeyboard,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';

import ChatListHeader from '../components/ChatListHeader';
import AgentSelectionSheet from '../components/ui/AgentSelectionSheet';
import AttachmentSheet from '../components/ui/AttachmentSheet';
import { ChatComposerBody } from '../components/ui/ChatComposerBody';
import EmptyState from '../components/ui/EmptyState';
import FilePreview from '../components/ui/FilePreview';
import ListSkeleton from '../components/ui/ListSkeleton';
import MemoryToolSheet from '../components/ui/MemoryToolSheet';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import PromptModal from '../components/ui/PromptModal';
import { QuickActionChip } from '../components/ui/QuickActionChip';
import ResourcePickerSheet from '../components/ui/ResourcePickerSheet';
import { HeaderIconButton } from '../components/ui/ScreenHeader';
import { SectionBlock } from '../components/ui/SectionBlock';
import SkillsSheet from '../components/ui/SkillsSheet';
import { TagEditorSheet } from '../components/ui/TagEditorSheet';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl, inferProviderFromModelId } from '../constants/cdn';
import type { MobileRecommendedBuiltinIcon } from '../constants/recommendedBuiltins';
import { MOBILE_RECOMMENDED_BUILTIN_SKILLS } from '../constants/recommendedBuiltins';
import { DEFAULT_INBOX_AVATAR, INBOX_SESSION_ID, isBuiltinInboxAvatar } from '../constants/session';
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
import { ANDROID_COMPOSER_LIFT_ADJUSTMENT, getKeyboardOffset } from '../lib/keyboard';
import { navigateToLogin } from '../lib/navigation';
import {
  PERSONAL_NOTEBOOK_SESSION_STORAGE_KEY,
  shouldHidePersonalNotebookSession,
} from '../lib/personalNotebookSession';
import { useResolvedRemoteAsset } from '../lib/remoteAsset';
import { loadSkillPickerSelection, saveSkillPickerSelection } from '../lib/skillPicker';
import { recordUsage } from '../lib/streak';
import { generateBestTitle } from '../lib/titleGeneration';
import type { MainTabScreenProps } from '../navigation/types';
import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useModelStore } from '../store/model';
import { useSessionStore } from '../store/session';
import { useThemeStore } from '../store/theme';
import { EMPTY_TOPICS, useTopicStore } from '../store/topic';
import { getUserMemorySettings } from '../store/user';
import { useThemeColors } from '../theme/colors';
import { enteringEmptyState, enteringSection } from '../theme/motion';
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

interface SidebarTopicMeta {
  id: string;
  sessionId: string;
  tagId?: string | null;
  title: string;
  updatedAt: string;
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

const DIRECTORY_DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.88, 390);
/** Collapsed recents in directory drawer before "Show all". */
const SIDEBAR_RECENTS_VISIBLE = 20;
const SIDEBAR_TAG_FILTER_ALL = '__all__';
const SIDEBAR_TAG_FILTER_NONE = '__none__';
const AVATO_AGENT_LOGO_ASSET = require('../../assets/avato-logo.png');

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
  const avatoLogoTint = effectiveTheme === 'dark' ? colors.foreground : undefined;
  const iconSize = size * 0.65;
  const iconUrl =
    providerLogo || (provider ? getProviderIconUrl(provider, effectiveTheme) : undefined);
  const resolvedAvatarUri = useResolvedRemoteAsset(avatar);
  const isInboxAvatar = isBuiltinInboxAvatar(avatar);
  const isEmojiAvatar =
    !!avatar &&
    avatar.length <= 4 &&
    !avatar.startsWith('/') &&
    !avatar.startsWith('http://') &&
    !avatar.startsWith('https://') &&
    !avatar.startsWith('file://') &&
    !avatar.startsWith('data:') &&
    !avatar.startsWith('content://');
  const shouldHoldAvatarSlot = !!avatar && !isInboxAvatar && !isEmojiAvatar && !resolvedAvatarUri;

  useEffect(() => {
    setImgError(false);
  }, [iconUrl, resolvedAvatarUri]);

  if (isInbox) {
    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        <RNImage
          resizeMode="contain"
          source={AVATO_AGENT_LOGO_ASSET}
          style={{
            width: size,
            height: size,
            ...(avatoLogoTint ? { tintColor: avatoLogoTint } : {}),
          }}
        />
      </View>
    );
  }

  if (avatar) {
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
    } else if (isEmojiAvatar && !resolvedAvatarUri) {
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
            cachePolicy="memory-disk"
            contentFit="cover"
            source={{ uri: resolvedAvatarUri }}
            style={{ width: size, height: size }}
            transition={0}
          />
        </View>
      );
    }

    if (shouldHoldAvatarSlot) {
      return (
        <View
          className="rounded-full bg-foreground/5 items-center justify-center overflow-hidden"
          style={{ width: size, height: size }}
        />
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
        <Image
          cachePolicy="memory-disk"
          contentFit="contain"
          source={{ uri: iconUrl }}
          style={{ width: iconSize, height: iconSize }}
          transition={0}
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
        <Text className="font-semibold" style={{ color: colors.primary, fontSize: size * 0.55 }}>
          #
        </Text>
      )}
    </View>
  );
}

export default function ChatListScreen({ navigation }: MainTabScreenProps<'Chats'>) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const effectiveTheme = useThemeStore((s) => s.effectiveTheme);

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
  const [activeTagFilterId, setActiveTagFilterId] = useState(SIDEBAR_TAG_FILTER_ALL);
  const [inboxSession, setInboxSession] = useState<ChatSession | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionSession, setActionSession] = useState<ChatSession | null>(null);
  const [_actionPanel, setActionPanel] = useState<'root' | 'move-tag'>('root');
  const [createGroupSheetVisible, setCreateGroupSheetVisible] = useState(false);
  const [draftAssistantPickerVisible, setDraftAssistantPickerVisible] = useState(false);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [directoryVisible, setDirectoryVisible] = useState(false);
  const [directoryMounted, setDirectoryMounted] = useState(false);
  const [sidebarRecentsExpanded, setSidebarRecentsExpanded] = useState(false);
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
  const [tagEditorVisible, setTagEditorVisible] = useState(false);
  const [tagDraftName, setTagDraftName] = useState('');
  const [tagDraftColor, setTagDraftColor] = useState<string | null>(null);
  const [tagEditingTarget, setTagEditingTarget] = useState<TagItem | null>(null);
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
  const hasBootstrappedRef = useRef(false);
  const inboxSessionPromiseRef = useRef<Promise<ChatSession | null> | null>(null);
  const lastHomeRefreshAtRef = useRef(0);
  const lastRecentTopicsRefreshAtRef = useRef(0);
  const hydratedTopicSessionIdsRef = useRef<Set<string>>(new Set());
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
  const browsableSessions = useMemo(
    () =>
      [visibleInboxSession, ...visibleSessions].filter(
        (session): session is ChatSession => !!session,
      ),
    [visibleInboxSession, visibleSessions],
  );
  const getSessionDisplayTitle = useCallback(
    (session?: ChatSession | null) =>
      session?.id === visibleInboxSession?.id ? 'Avato' : session?.title || 'Avato',
    [visibleInboxSession?.id],
  );
  const draftAgentSessions = useMemo(() => {
    const entries = [
      visibleInboxSession,
      ...visibleSessions.filter((session) => session.type !== 'group'),
    ].filter(Boolean) as ChatSession[];

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

  const topicStoreSessionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const s of browsableSessions) ids.add(s.id);
    for (const s of draftAgentSessions) ids.add(s.id);
    for (const rt of recentTopics) {
      if (rt.sessionId) ids.add(rt.sessionId);
    }
    for (const r of searchResults) {
      ids.add(r.session.id);
    }
    return Array.from(ids).sort();
  }, [browsableSessions, draftAgentSessions, recentTopics, searchResults]);

  const topicsBySession = useTopicStore(
    useShallow((s) => {
      const o: Record<string, Topic[]> = {};
      for (const id of topicStoreSessionIds) {
        o[id] = s.topicsBySession[id] ?? EMPTY_TOPICS;
      }
      return o;
    }),
  );

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

  const tagById = useMemo(() => Object.fromEntries(tags.map((tag) => [tag.id, tag])), [tags]);
  const closeTagEditor = useCallback(() => {
    setTagDraftName('');
    setTagDraftColor(null);
    setTagEditingTarget(null);
    setTagEditorVisible(false);
  }, []);
  const openCreateTagEditor = useCallback(() => {
    haptics.light();
    setTagEditingTarget(null);
    setTagDraftName('');
    setTagDraftColor(null);
    setTagEditorVisible(true);
  }, []);
  const openEditTagEditor = useCallback((tag: TagItem) => {
    haptics.light();
    setTagEditingTarget(tag);
    setTagDraftName(tag.name ?? '');
    setTagDraftColor(tag.color ?? null);
    setTagEditorVisible(true);
  }, []);

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
            title: 'Avato',
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
            model:
              typeof inboxConfig?.model === 'string' && inboxConfig.model.length > 0
                ? inboxConfig.model
                : undefined,
            pinned: false,
            provider:
              typeof inboxConfig?.provider === 'string' && inboxConfig.provider.length > 0
                ? inboxConfig.provider
                : undefined,
            title: 'Avato',
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

  const refreshRecentTopics = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastRecentTopicsRefreshAtRef.current < 30_000) return;

    lastRecentTopicsRefreshAtRef.current = now;

    try {
      const data = await topicApi.recentTopics(24);
      setRecentTopics(data ?? []);
    } catch {
      setRecentTopics([]);
    }
  }, []);

  const refreshHomeData = useCallback(
    async (options?: { force?: boolean; includeRecentTopics?: boolean }) => {
      const force = options?.force ?? false;
      const includeRecentTopics = options?.includeRecentTopics ?? false;
      const now = Date.now();

      if (!force && now - lastHomeRefreshAtRef.current < 45_000) {
        if (includeRecentTopics) {
          void refreshRecentTopics(false);
        }
        return;
      }

      lastHomeRefreshAtRef.current = now;

      const tasks: Promise<unknown>[] = [];

      if (!initialized || force) {
        tasks.push(fetchSessions());
      }

      tasks.push(fetchModels());
      tasks.push(loadSelection());
      tasks.push(fetchTags());
      tasks.push(ensureInboxSession());
      tasks.push(loadSkillPickerSelection().then(setPersistedSkillIdentifiers));
      tasks.push(loadGlobalMemorySettings());

      if (includeRecentTopics) {
        tasks.push(refreshRecentTopics(force));
      }

      await Promise.allSettled(tasks);
    },
    [
      ensureInboxSession,
      fetchModels,
      fetchSessions,
      fetchTags,
      initialized,
      loadGlobalMemorySettings,
      loadSelection,
      refreshRecentTopics,
    ],
  );

  useEffect(() => {
    if (hasBootstrappedRef.current) return;

    hasBootstrappedRef.current = true;
    void refreshHomeData({ force: true, includeRecentTopics: true });
    void recordUsage();
  }, [refreshHomeData]);

  // Re-read sessions (with AsyncStorage provider overlay) whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      void refreshHomeData({ includeRecentTopics: true });
    }, [refreshHomeData]),
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
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardOffset(getKeyboardOffset(event, insets.bottom));
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
            Keyboard.addListener('keyboardWillChangeFrame', (event) => {
              if (getKeyboardOffset(event, insets.bottom) <= 0) {
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
  }, [insets.bottom]);

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
  }, [directoryMounted, directoryVisible, drawerBackdropOpacity, drawerTranslateX]);

  useEffect(() => {
    if (!directoryVisible) setSidebarRecentsExpanded(false);
  }, [directoryVisible]);

  useEffect(() => {
    void refreshRecentTopics();
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

      void (async () => {
        const personalNotebookSessionId = await AsyncStorage.getItem(
          PERSONAL_NOTEBOOK_SESSION_STORAGE_KEY,
        );

        let matchedSessions: Awaited<ReturnType<typeof sessionApi.search>>;
        try {
          const [sessionsResult, topics, messages] = await Promise.all([
            sessionApi.search(keywords).catch(() => []),
            topicApi.search(keywords).catch(() => []),
            messageApi.search(keywords).catch(() => []),
          ]);
          matchedSessions = sessionsResult.filter(
            (s) => !shouldHidePersonalNotebookSession(s, personalNotebookSessionId),
          );

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
        } catch {
          if (!isCancelled) {
            toast.show('error', t.errorNetwork);
          }
        } finally {
          if (!isCancelled) {
            setSearching(false);
          }
        }
      })();
    }, 260);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchText, sessions, t.chatListNewConversation, t.errorNetwork, toast]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshHomeData({ force: true, includeRecentTopics: true });
      haptics.success();
    } catch {
      toast.show('error', t.errorNetwork);
    }
    setRefreshing(false);
  }, [refreshHomeData, toast, t]);

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

  const handleCreateAgent = useCallback(async () => {
    haptics.light();
    try {
      const result = await agentApi.create();
      if (result?.sessionId) {
        setDirectoryVisible(false);
        await fetchSessions();
        navigation?.navigate?.('ChatDetail', { sessionId: result.sessionId });
      }
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [fetchSessions, navigation, t.errorNetwork, toast]);

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
        setTimeout(() => searchInputRef.current?.focus(), Platform.OS === 'ios' ? 120 : 220);
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
          new Set(configuredPlugins.length > 0 ? configuredPlugins : persistedSkillIdentifiers),
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

  const sidebarTopicsBySessionId = useMemo(() => {
    const map = new Map<string, SidebarTopicMeta[]>();
    const seenTopicIds = new Set<string>();

    const pushTopic = (topic: SidebarTopicMeta) => {
      if (!topic.sessionId || seenTopicIds.has(topic.id)) return;

      seenTopicIds.add(topic.id);
      const existing = map.get(topic.sessionId) ?? [];
      existing.push(topic);
      map.set(topic.sessionId, existing);
    };

    for (const [sessionId, topics] of Object.entries(topicsBySession)) {
      for (const topic of topics ?? []) {
        const updatedAt =
          typeof topic.updatedAt === 'string'
            ? topic.updatedAt
            : ((topic.updatedAt as Date)?.toISOString?.() ?? '');

        pushTopic({
          id: topic.id,
          sessionId,
          tagId: topic.tagId ?? null,
          title: topic.title ?? '',
          updatedAt,
        });
      }
    }

    for (const topic of recentTopics) {
      if (!topic.sessionId) continue;

      const updatedAt =
        typeof topic.updatedAt === 'string'
          ? topic.updatedAt
          : ((topic.updatedAt as Date)?.toISOString?.() ?? '');

      pushTopic({
        id: topic.id,
        sessionId: topic.sessionId,
        tagId: topic.tagId ?? null,
        title: topic.title ?? '',
        updatedAt,
      });
    }

    for (const topics of map.values()) {
      topics.sort((left, right) => {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
    }

    return map;
  }, [recentTopics, topicsBySession]);

  /** sessionId -> latest topic for sidebar preview and tag filter */
  const latestTopicBySessionId = useMemo(() => {
    const map = new Map<
      string,
      { tagId?: string | null; title: string; topicId: string; updatedAt: string }
    >();

    for (const [sessionId, topics] of sidebarTopicsBySessionId.entries()) {
      const latestTopic = topics[0];
      if (!latestTopic) continue;

      map.set(sessionId, {
        tagId: latestTopic.tagId ?? null,
        title: latestTopic.title,
        topicId: latestTopic.id,
        updatedAt: latestTopic.updatedAt,
      });
    }

    return map;
  }, [sidebarTopicsBySessionId]);

  const tagTopicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let totalTopicCount = 0;
    let untaggedCount = 0;

    for (const session of browsableSessions) {
      const topics = sidebarTopicsBySessionId.get(session.id) ?? [];
      totalTopicCount += topics.length;

      if (session.type === 'group') continue;

      for (const topic of topics) {
        const tagId = topic.tagId ?? null;
        if (tagId) {
          counts.set(tagId, (counts.get(tagId) ?? 0) + 1);
        } else {
          untaggedCount += 1;
        }
      }
    }

    return { counts, totalTopicCount, untaggedCount };
  }, [browsableSessions, sidebarTopicsBySessionId]);

  const assistantCount = useMemo(
    () => browsableSessions.filter((session) => session.type !== 'group').length,
    [browsableSessions],
  );
  const groupCount = useMemo(
    () => browsableSessions.filter((session) => session.type === 'group').length,
    [browsableSessions],
  );
  const topicCount = tagTopicCounts.totalTopicCount;
  const assistantSummaryLabel =
    t.chatListAssistants === 'Assistants' ? 'Agents' : t.chatListAssistants;

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

  useEffect(() => {
    if (
      activeTagFilterId !== SIDEBAR_TAG_FILTER_ALL &&
      activeTagFilterId !== SIDEBAR_TAG_FILTER_NONE &&
      !tagById[activeTagFilterId]
    ) {
      setActiveTagFilterId(SIDEBAR_TAG_FILTER_ALL);
    }
  }, [activeTagFilterId, tagById]);

  const matchesActiveTagFilter = useCallback(
    (session?: ChatSession | null) => {
      if (!session) return false;
      if (activeTagFilterId === SIDEBAR_TAG_FILTER_ALL) return true;
      if (session.type === 'group') return false;

      const topics = sidebarTopicsBySessionId.get(session.id) ?? [];
      if (activeTagFilterId === SIDEBAR_TAG_FILTER_NONE) {
        return topics.some((topic) => !topic.tagId);
      }

      return topics.some((topic) => topic.tagId === activeTagFilterId);
    },
    [activeTagFilterId, sidebarTopicsBySessionId],
  );

  const filteredInboxSession = matchesActiveTagFilter(visibleInboxSession)
    ? visibleInboxSession
    : null;
  const { pinnedSessions, filteredSessions } = useMemo(() => {
    const matchedSessions = visibleSessions.filter((session) => matchesActiveTagFilter(session));
    const pinned = matchedSessions.filter((session) => session.pinned);
    const rest = matchedSessions.filter((session) => !session.pinned);
    return { pinnedSessions: pinned, filteredSessions: rest };
  }, [matchesActiveTagFilter, visibleSessions]);
  const hasFilteredSidebarSessions =
    pinnedSessions.length > 0 || filteredSessions.length > 0 || Boolean(filteredInboxSession);
  const hasSidebarRecentsContent = Boolean(filteredInboxSession) || filteredSessions.length > 0;
  const activeTagFilterLabel = useMemo(() => {
    if (activeTagFilterId === SIDEBAR_TAG_FILTER_ALL) return t.homeAgentAll;
    if (activeTagFilterId === SIDEBAR_TAG_FILTER_NONE) return t.tagNone;
    return tagById[activeTagFilterId]?.name ?? t.homeAgentAll;
  }, [activeTagFilterId, t.homeAgentAll, t.tagNone, tagById]);
  const activeTagFilterCount = useMemo(() => {
    if (activeTagFilterId === SIDEBAR_TAG_FILTER_ALL) return topicCount;
    if (activeTagFilterId === SIDEBAR_TAG_FILTER_NONE) return tagTopicCounts.untaggedCount;

    return tagTopicCounts.counts.get(activeTagFilterId) ?? 0;
  }, [activeTagFilterId, tagTopicCounts, topicCount]);

  const handleSubmitTag = useCallback(async () => {
    const name = tagDraftName.trim();
    if (!name) {
      toast.show('error', t.errorUnknown);
      return;
    }

    try {
      if (tagEditingTarget) {
        await tagApi.update(tagEditingTarget.id, {
          color: tagDraftColor,
          name,
        });
      } else {
        const createdTagId = await tagApi.create(name, tagDraftColor);
        if (!createdTagId) {
          toast.show('error', t.errorNetwork);
          return;
        }
        setActiveTagFilterId(createdTagId);
      }

      await fetchTags();
      await refreshRecentTopics(true);
      closeTagEditor();
      haptics.success();
    } catch (err) {
      const { messageKey, type } = classifyError(err);
      toast.show('error', t[messageKey], {
        onRetry: type === 'auth' ? navigateToLogin : undefined,
        retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
      });
    }
  }, [
    closeTagEditor,
    fetchTags,
    refreshRecentTopics,
    t,
    tagDraftColor,
    tagDraftName,
    tagEditingTarget,
    toast,
  ]);

  const handleDeleteTag = useCallback(() => {
    if (!tagEditingTarget) return;

    Alert.alert(t.tagDeleteConfirm, t.tagDeleteDesc, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await tagApi.remove(tagEditingTarget.id);
              await fetchTags();
              await refreshRecentTopics(true);
              if (activeTagFilterId === tagEditingTarget.id) {
                setActiveTagFilterId(SIDEBAR_TAG_FILTER_ALL);
              }
              closeTagEditor();
              haptics.success();
            } catch (err) {
              const { messageKey, type } = classifyError(err);
              toast.show('error', t[messageKey], {
                onRetry: type === 'auth' ? navigateToLogin : undefined,
                retryLabel: type === 'auth' ? t.errorAuthGoToLogin : undefined,
              });
            }
          })();
        },
      },
    ]);
  }, [
    activeTagFilterId,
    closeTagEditor,
    fetchTags,
    refreshRecentTopics,
    t,
    tagEditingTarget,
    toast,
  ]);

  useEffect(() => {
    if (draftAgentSessions.length === 0) return;

    const hasSelectedDraft =
      draftSessionId && draftAgentSessions.some((session) => session.id === draftSessionId);

    if (!hasSelectedDraft) {
      setDraftSessionId(draftAgentSessions[0].id);
    }
  }, [draftAgentSessions, draftSessionId]);

  const ensureSessionTopicsLoaded = useCallback(
    (sessionId: string) => {
      if (hydratedTopicSessionIdsRef.current.has(sessionId)) return;

      hydratedTopicSessionIdsRef.current.add(sessionId);
      void fetchTopics(sessionId).catch(() => {
        hydratedTopicSessionIdsRef.current.delete(sessionId);
      });
    },
    [fetchTopics],
  );

  useEffect(() => {
    setExpandedSessionIds((current) => {
      const next = new Set(current);
      let changed = false;

      for (const session of browsableSessions) {
        ensureSessionTopicsLoaded(session.id);
        if (!next.has(session.id)) {
          next.add(session.id);
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [browsableSessions, ensureSessionTopicsLoaded]);

  const filteredSearchResults = searchResults;

  const handleCreateGroup = useCallback(async () => {
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

  const renderSidebarTagFilterChip = useCallback(
    ({
      color,
      count,
      filterId,
      label,
    }: {
      color?: string | null;
      count: number;
      filterId: string;
      label: string;
    }) => {
      const active = activeTagFilterId === filterId;
      const resolvedColor = color ? resolveTagColor(color) : colors.primary;

      return (
        <TouchableOpacity
          activeOpacity={0.78}
          className="flex-row items-center rounded-full px-3 py-2.5"
          hitSlop={{ bottom: 4, left: 2, right: 2, top: 4 }}
          key={filterId}
          style={{
            backgroundColor: active
              ? color
                ? withAlpha(color, '18')
                : colors.primarySubtle
              : colors.surfaceElevated,
            borderColor: active
              ? color
                ? withAlpha(color, '44')
                : colors.primaryBorder
              : colors.borderSubtle,
            borderWidth: 1,
          }}
          onLongPress={() => {
            const targetTag = tagById[filterId];
            if (targetTag) {
              openEditTagEditor(targetTag);
            }
          }}
          onPress={() => {
            haptics.light();
            setActiveTagFilterId(filterId);
          }}
        >
          <View
            className="mr-2 h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor:
                filterId === SIDEBAR_TAG_FILTER_NONE ? colors.secondaryText : resolvedColor,
            }}
          />
          <Text
            className="text-[12px] font-semibold"
            style={{ color: active ? resolvedColor : colors.foreground }}
          >
            {label}
          </Text>
          <Text
            className="ml-1.5 text-[11px] font-semibold"
            style={{ color: active ? resolvedColor : colors.secondaryText }}
          >
            {count}
          </Text>
        </TouchableOpacity>
      );
    },
    [
      activeTagFilterId,
      colors.borderSubtle,
      colors.foreground,
      colors.primary,
      colors.primaryBorder,
      colors.primarySubtle,
      colors.secondaryText,
      colors.surfaceElevated,
      openEditTagEditor,
      tagById,
    ],
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
      toast.show('success', t.topicRenamed);
      void refreshRecentTopics();
    },
    [refreshRecentTopics, t.topicRenamed, toast, updateTopic],
  );

  const [smartRenamingTopicId, setSmartRenamingTopicId] = useState<string | null>(null);
  const handleTopicSmartRename = useCallback(
    async (topicId: string, sessionId: string) => {
      if (smartRenamingTopicId) return;
      haptics.light();
      setSmartRenamingTopicId(topicId);
      const failMsg = [
        t.toastTitleGenerationFailed || 'Failed to generate title',
        t.toastTitleGenerationFailedHint || '',
      ]
        .filter(Boolean)
        .join(' ');
      try {
        const result = await generateBestTitle({ force: true, sessionId, topicId });
        if (result?.title) {
          toast.show('success', result.target === 'topic' ? t.topicRenamed : t.sessionRenamed);
          void refreshRecentTopics();
        } else {
          toast.show('error', failMsg);
        }
      } catch {
        toast.show('error', failMsg);
      } finally {
        setSmartRenamingTopicId(null);
      }
    },
    [
      refreshRecentTopics,
      smartRenamingTopicId,
      t.sessionRenamed,
      t.toastTitleGenerationFailed,
      t.toastTitleGenerationFailedHint,
      t.topicRenamed,
      toast,
    ],
  );

  const toggleAssistantExpand = useCallback(
    (sessionId: string) => {
      haptics.light();
      setExpandedSessionIds((prev) => {
        const next = new Set(prev);
        if (next.has(sessionId)) {
          next.delete(sessionId);
        } else {
          next.add(sessionId);
          ensureSessionTopicsLoaded(sessionId);
        }
        return next;
      });
    },
    [ensureSessionTopicsLoaded],
  );

  const renderAssistantRow = (item: ChatSession, showTopicPreview?: boolean) => {
    const itemIsInbox = isInboxSession(item);
    const providerId =
      item.provider || (item.model ? inferProviderFromModelId(item.model) : undefined);
    const isExpanded = expandedSessionIds.has(item.id);
    const latestTopic = latestTopicBySessionId.get(item.id);
    const previewTagId = latestTopic?.tagId ?? undefined;
    const previewTime = latestTopic?.updatedAt
      ? formatTimeAgo(latestTopic.updatedAt, t)
      : item.updatedAt
        ? formatTimeAgo(item.updatedAt, t)
        : null;
    const topics = topicsBySession[item.id] ?? [];
    return (
      <View
        className="mx-4 mb-2.5 overflow-hidden rounded-[20px]"
        key={item.id}
        style={{
          backgroundColor: colors.fillQuaternary,
          borderColor: isExpanded ? colors.primaryBorder : colors.borderSubtle,
          borderWidth: 1,
        }}
      >
        <View className="flex-row items-center">
          <TouchableOpacity
            accessibilityLabel={item.title}
            accessibilityRole="button"
            activeOpacity={0.4}
            className="flex-1 flex-row items-start px-3.5 py-3.5 active:bg-foreground/5"
            onLongPress={() => handleLongPress(item)}
            onPress={() => toggleAssistantExpand(item.id)}
          >
            <View className="mr-3 mt-0.5 h-10 w-10 items-center justify-center rounded-full">
              <SessionLogo
                avatar={item.avatar}
                isGroup={item.type === 'group'}
                isInbox={itemIsInbox}
                provider={providerId}
                size={38}
              />
            </View>
            <View className="mr-2.5 mt-0.5 flex-1">
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
              <Text
                className="text-[12px] font-medium"
                numberOfLines={2}
                style={{ color: colors.secondaryText }}
              >
                {showTopicPreview
                  ? (() => {
                      if (latestTopic?.title) return `${t.topicTitle}: ${latestTopic.title}`;
                      if (itemIsInbox) return item.description || '';
                      return item.description ?? '';
                    })()
                  : (item.description ?? '')}
              </Text>
              {showTopicPreview && (previewTagId || item.type === 'group' || previewTime) ? (
                <View className="mt-2 flex-row flex-wrap items-center">
                  {item.type === 'group' ? renderGroupTagChip() : renderTagChip(previewTagId)}
                  {previewTime ? (
                    <Text
                      className="ml-2 text-[11px] font-medium"
                      style={{ color: colors.secondaryText }}
                    >
                      {previewTime}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.7}
            className="px-3.5 py-3.5"
            accessibilityLabel={
              isExpanded ? t.chatListCollapseAssistant : t.chatListExpandAssistant
            }
            onPress={(e) => {
              e.stopPropagation();
              toggleAssistantExpand(item.id);
            }}
          >
            {isExpanded ? (
              <ChevronUp
                color={colors.secondaryText}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
            ) : (
              <ChevronDown
                color={colors.secondaryText}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
            )}
          </TouchableOpacity>
        </View>
        {isExpanded && topics.length > 0 && (
          <View
            className="px-3.5 pb-3.5 pt-1.5"
            style={{ borderColor: colors.borderSubtle, borderTopWidth: 1 }}
          >
            {topics.map((topic: Topic) => (
              <TouchableOpacity
                accessibilityLabel={topic.title}
                accessibilityRole="button"
                activeOpacity={0.65}
                className="mt-2 flex-row items-center rounded-xl px-3 py-2.5 active:bg-foreground/5"
                key={topic.id}
                style={{
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                }}
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
                onPress={() => {
                  setDirectoryVisible(false);
                  navigation.navigate('ChatDetail', {
                    sessionId: item.id,
                    topicId: topic.id,
                  });
                }}
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
                <Text
                  className="ml-2 text-[11px] font-medium"
                  style={{ color: colors.secondaryText }}
                >
                  {formatTimeAgo(topic.updatedAt, t)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {isExpanded && topics.length === 0 && (
          <View
            className="px-3.5 pb-3.5 pt-2.5"
            style={{ borderColor: colors.borderSubtle, borderTopWidth: 1 }}
          >
            <Text className="text-[13px]" style={{ color: colors.secondaryText }}>
              {t.chatListTopicEmpty}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderSearchResultRow = useCallback(
    ({ matchType, messageId, session, summary, topicId }: SearchSessionResult) => {
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
          className="mx-4 mb-3 flex-row items-start rounded-2xl px-4 py-4"
          style={{
            backgroundColor: colors.fillQuaternary,
            borderColor: colors.borderSubtle,
            borderWidth: 1,
          }}
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
              isGroup={session.type === 'group'}
              isInbox={isInboxSession(session)}
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
            </View>
            <Text
              className="text-[12px] font-medium leading-5"
              numberOfLines={2}
              style={{ color: colors.secondaryText }}
            >
              {summary}
            </Text>
            <View className="mt-2 flex-row items-center flex-wrap">
              {session.type === 'group'
                ? renderGroupTagChip()
                : renderTagChip(topicTagId ?? undefined)}
              <View
                className="ml-2 rounded-full px-2.5 py-1"
                style={{
                  backgroundColor: colors.surfaceElevated,
                  borderColor: colors.borderSubtle,
                  borderWidth: 1,
                }}
              >
                <Text className="text-[10px] font-semibold" style={{ color: colors.secondaryText }}>
                  {matchType === 'session'
                    ? t.chatSearchMatchSession
                    : matchType === 'topic'
                      ? t.chatSearchMatchTopic
                      : t.chatSearchMatchMessage}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [
      colors.borderSubtle,
      colors.fillQuaternary,
      colors.secondaryText,
      colors.surfaceElevated,
      isInboxSession,
      latestTopicBySessionId,
      navigation,
      renderGroupTagChip,
      renderTagChip,
      t.chatListNewConversation,
      t.chatSearchMatchMessage,
      t.chatSearchMatchSession,
      t.chatSearchMatchTopic,
      topicsBySession,
    ],
  );

  const renderSearchResultFlatItem = useCallback(
    ({ item }: ListRenderItemInfo<SearchSessionResult>) => renderSearchResultRow(item),
    [renderSearchResultRow],
  );

  const searchResultsListHeader = useMemo(
    () => (
      <View className="mb-4">
        <View className="flex-row items-center justify-between px-4 mb-2">
          <Text
            className="text-[11px] font-semibold uppercase tracking-[1.2px]"
            style={{ color: colors.secondaryText }}
          >
            {t.chatSearchResults}
          </Text>
        </View>
      </View>
    ),
    [colors.secondaryText, t.chatSearchResults],
  );

  const searchQuery = searchText.trim();
  const homeSuggestions = useMemo(
    () => [
      { icon: Search, label: t.chatSuggest1 },
      { icon: Cpu, label: t.chatSuggest2 },
      { icon: Wand2, label: t.chatSuggest3 },
      { icon: FileText, label: t.chatSuggest4 },
    ],
    [t],
  );
  const homeHeroMinHeight = Math.max(Dimensions.get('window').height * 0.36, 320);
  const animatedKeyboard = useAnimatedKeyboard();
  const composerLiftStyle = useAnimatedStyle(() => {
    const lift =
      Platform.OS === 'android'
        ? Math.max(
            0,
            animatedKeyboard.height.value - insets.bottom - ANDROID_COMPOSER_LIFT_ADJUSTMENT,
          )
        : keyboardOffset;

    return {
      transform: [{ translateY: -lift }],
    };
  }, [insets.bottom, keyboardOffset]);
  const composerActive = keyboardOffset > 0 || Boolean(heroText.trim()) || pendingFiles.length > 0;
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
        event.translationX < -DIRECTORY_DRAWER_WIDTH * 0.2 || event.velocityX < -520;

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
      const shouldOpen = event.translationX > 56 || event.velocityX > 480;

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
              width: 52,
              zIndex: 30,
            }}
          />
        </GestureDetector>
      ) : null}
      <ChatListHeader
        directoryVisible={directoryVisible}
        subtitle={selectedModel}
        title={getSessionDisplayTitle(draftSession)}
        avatar={
          <SessionLogo
            isInbox={draftSessionIsInbox}
            providerLogo={draftSessionIsInbox ? undefined : toolbarProviderLogo}
            size={34}
            avatar={
              draftSessionIsInbox
                ? draftSession?.avatar || DEFAULT_INBOX_AVATAR
                : draftSession?.avatar
            }
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
          />
        }
        onOpenAssistantPicker={() => {
          haptics.light();
          setDraftAssistantPickerVisible(true);
        }}
        onOpenDirectory={() => {
          haptics.light();
          setDirectoryVisible(true);
        }}
      />

      <View className="flex-1">
        <ScrollView
          className="flex-1"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: insets.bottom + 116,
            paddingTop: 18,
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
              minHeight: homeHeroMinHeight,
              paddingTop: 10,
            }}
          >
            {sessionErrorMessage ? (
              <Animated.View entering={enteringSection(180)}>
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
              <Animated.View entering={enteringEmptyState()}>
                <EmptyState
                  compact
                  className="px-5 pb-2 pt-6"
                  description={t.chatEmptyDesc}
                  iconVariant="chat"
                  title={t.chatEmptyWave}
                  action={
                    <Animated.View
                      className="w-full items-center"
                      entering={enteringSection(200)}
                      style={{ alignSelf: 'center', maxWidth: 320 }}
                    >
                      <View className="mt-3 w-full flex-row flex-wrap justify-between gap-y-3">
                        {homeSuggestions.map(({ icon: Icon, label }) => (
                          <QuickActionChip
                            className="w-[48.5%] justify-center px-4 py-3"
                            key={label}
                            label={label}
                            icon={
                              <Icon
                                color={colors.primary}
                                size={15}
                                strokeWidth={tokens.icon.strokeWidth}
                              />
                            }
                            onPress={() => {
                              haptics.light();
                              setHeroText(label);
                            }}
                          />
                        ))}
                      </View>
                    </Animated.View>
                  }
                />
              </Animated.View>
            )}
          </View>
        </ScrollView>

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
            canSend={Boolean(heroText.trim()) || pendingFiles.length > 0}
            memoryEnabled={memoryEnabled}
            modelDrawerVisible={modelDrawerVisible}
            pendingFilesCount={pendingFiles.length}
            placeholder={hints[hintIndex]}
            pluginsEnabled={enabledSkills.size > 0}
            providerLogoError={providerLogoError}
            searchEnabled={webSearchEnabled}
            toolbarProviderLogo={toolbarProviderLogo}
            value={heroText}
            variant="home"
            topSlot={
              pendingFiles.length > 0 ? (
                <View className="px-3 pt-2">
                  <FilePreview />
                </View>
              ) : undefined
            }
            onAttach={handleAttach}
            onChangeText={setHeroText}
            onMemoryPress={handleToggleMemory}
            onModelPress={handleModelPress}
            onPluginsPress={handlePluginsPress}
            onProviderLogoError={() => setProviderLogoError(true)}
            onSend={handleHeroSubmit}
            onToggleSearch={handleToggleWebSearch}
          />
        </Animated.View>
      </View>

      <Modal
        accessibilityViewIsModal
        transparent
        accessibilityLabel={t.tabChats}
        animationType="none"
        visible={directoryMounted}
        onRequestClose={() => setDirectoryVisible(false)}
      >
        <View className="flex-1">
          <Animated.View
            style={[
              {
                backgroundColor: colors.modalOverlay,
                bottom: 0,
                left: 0,
                position: 'absolute',
                right: 0,
                top: 0,
              },
              drawerBackdropStyle,
            ]}
          >
            <Pressable
              accessibilityElementsHidden
              className="flex-1"
              importantForAccessibility="no-hide-descendants"
              onPress={() => {
                haptics.light();
                setDirectoryVisible(false);
              }}
            />
          </Animated.View>
          <GestureDetector gesture={drawerGesture}>
            <Animated.View
              className="h-full overflow-hidden"
              style={[
                {
                  backgroundColor: colors.background,
                  borderBottomRightRadius: 28,
                  borderColor: colors.borderSubtle,
                  borderRightWidth: StyleSheet.hairlineWidth,
                  borderTopRightRadius: 28,
                  elevation: 24,
                  paddingTop: insets.top + 6,
                  shadowColor: colors.shadow,
                  shadowOffset: { height: 12, width: -4 },
                  shadowOpacity: 0.14,
                  shadowRadius: 20,
                  width: DIRECTORY_DRAWER_WIDTH,
                },
                drawerStyle,
              ]}
            >
              <View
                accessible={false}
                className="items-center pb-2 pt-0.5"
                importantForAccessibility="no-hide-descendants"
              >
                <View
                  style={{
                    backgroundColor: withAlpha(colors.foreground, '16'),
                    borderRadius: 100,
                    height: 5,
                    width: 42,
                  }}
                />
              </View>

              <View className="px-4 pb-2">
                <View
                  className="px-3.5 py-3"
                  style={{
                    backgroundColor: colors.fillQuaternary,
                    borderColor: colors.borderSubtle,
                    borderRadius: 20,
                    borderWidth: 1,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="min-w-0 flex-1 pr-2">
                      <View className="flex-row items-center">
                        <View
                          className="h-10 w-10 items-center justify-center rounded-2xl"
                          style={{ backgroundColor: withAlpha(colors.primary, '14') }}
                        >
                          <MessageCircle
                            color={colors.primary}
                            size={18}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                        </View>
                        <View className="ml-3 min-w-0 flex-1">
                          <Text className="text-[18px] font-semibold tracking-tight text-foreground">
                            {t.tabChats}
                          </Text>
                          <View
                            className="mt-1.5 flex-row flex-wrap items-center"
                            style={{ gap: 6 }}
                          >
                            <View
                              className="rounded-full px-2.5 py-1"
                              style={{
                                backgroundColor: colors.surfaceElevated,
                                borderColor: colors.borderSubtle,
                                borderWidth: 1,
                              }}
                            >
                              <Text
                                className="text-[11px] font-semibold"
                                numberOfLines={1}
                                style={{ color: colors.secondaryText }}
                              >
                                {activeTagFilterLabel}
                              </Text>
                            </View>
                            <Text
                              className="text-[12px] font-medium"
                              style={{ color: colors.tertiaryText }}
                            >
                              {t.activeTopics.replace('{count}', String(activeTagFilterCount))}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                    <View className="flex-row items-center" style={{ gap: 4 }}>
                      <HeaderIconButton
                        accessibilityLabel={t.chatListSearch}
                        active={searchEnabled}
                        onPress={handleToggleSearch}
                      >
                        <Search
                          color={searchEnabled ? colors.primary : colors.secondaryText}
                          size={20}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      </HeaderIconButton>
                      <HeaderIconButton
                        accessibilityLabel={t.cancel}
                        onPress={() => {
                          haptics.light();
                          setDirectoryVisible(false);
                        }}
                      >
                        <X
                          color={colors.secondaryText}
                          size={20}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      </HeaderIconButton>
                    </View>
                  </View>

                  <Text
                    className="mt-3 text-[12px] font-medium leading-[18px]"
                    numberOfLines={2}
                    style={{ color: colors.tertiaryText }}
                  >
                    {`${assistantCount} ${assistantSummaryLabel} · ${groupCount} ${t.chatListViewGroup} · ${t.activeTopics.replace('{count}', String(topicCount))}`}
                  </Text>

                  <View className="mt-3" style={{ gap: 10 }}>
                    {(
                      [
                        [
                          {
                            accessibilityLabel: t.chatListNewAssistant,
                            icon: Bot,
                            label: t.chatListNewAssistant,
                            onPress: handleCreateAgent,
                            primary: true,
                          },
                          {
                            accessibilityLabel: t.chatListNewConversation,
                            icon: MessageSquarePlus,
                            label: t.chatListNewConversation,
                            onPress: handleCreateChat,
                            primary: false,
                          },
                        ],
                        [
                          {
                            accessibilityLabel: t.chatListCreateGroup,
                            icon: UsersRound,
                            label: t.chatListCreateGroup,
                            onPress: handleCreateGroup,
                            primary: false,
                          },
                          {
                            accessibilityLabel: t.tagCreate,
                            icon: Tag,
                            label: t.tagCreate,
                            onPress: openCreateTagEditor,
                            primary: false,
                          },
                        ],
                      ] as const
                    ).map((row, rowIndex) => (
                      <View className="flex-row" key={`dir-row-${rowIndex}`} style={{ gap: 10 }}>
                        {row.map(({ accessibilityLabel, icon: Icon, label, onPress, primary }) => (
                          <TouchableOpacity
                            accessibilityLabel={accessibilityLabel}
                            accessibilityRole="button"
                            activeOpacity={0.82}
                            className="flex-1 items-center justify-center rounded-2xl px-2 py-2.5"
                            key={accessibilityLabel}
                            style={{
                              backgroundColor: primary
                                ? colors.primarySubtle
                                : colors.surfaceElevated,
                              borderColor: primary ? colors.primaryBorder : colors.borderSubtle,
                              borderWidth: 1,
                              minHeight: 76,
                            }}
                            onPress={() => {
                              haptics.light();
                              void onPress();
                            }}
                          >
                            <Icon
                              color={primary ? colors.primary : colors.foreground}
                              size={18}
                              strokeWidth={tokens.icon.strokeWidth}
                            />
                            <Text
                              className="mt-1.5 text-center text-[11px] font-semibold leading-[14px]"
                              numberOfLines={2}
                              style={{ color: primary ? colors.primary : colors.foreground }}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </View>
                </View>
              </View>

              {searchEnabled ? (
                <Animated.View className="px-4 pb-2" entering={enteringSection()}>
                  <View
                    className="flex-row items-center rounded-2xl px-3.5 py-3"
                    style={{
                      backgroundColor: colors.fillQuaternary,
                      borderColor: colors.borderSubtle,
                      borderWidth: 1,
                    }}
                  >
                    <Search
                      color={colors.secondaryText}
                      size={tokens.icon.size.sm}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
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
                      <X
                        color={colors.secondaryText}
                        size={tokens.icon.size.sm}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ) : null}

              {searchQuery ? (
                searching ? (
                  <View
                    className="flex-1 items-center justify-center px-6"
                    style={{ paddingBottom: insets.bottom + 48, paddingTop: 4 }}
                  >
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text
                      className="mt-3 text-center text-[14px] font-medium"
                      style={{ color: colors.tertiaryText }}
                    >
                      {t.chatSearchSearching}
                    </Text>
                  </View>
                ) : filteredSearchResults.length > 0 ? (
                  <FlatList
                    ListHeaderComponent={searchResultsListHeader}
                    className="flex-1"
                    contentContainerStyle={{ paddingBottom: insets.bottom + 48, paddingTop: 4 }}
                    data={filteredSearchResults}
                    keyExtractor={(item) => item.id}
                    keyboardDismissMode="on-drag"
                    keyboardShouldPersistTaps="handled"
                    renderItem={renderSearchResultFlatItem}
                    showsVerticalScrollIndicator={false}
                    windowSize={10}
                  />
                ) : (
                  <View
                    className="flex-1"
                    style={{ paddingBottom: insets.bottom + 48, paddingTop: 4 }}
                  >
                    <EmptyState
                      compact
                      className="px-2 py-6"
                      description={t.chatSidebarSearchEmptyDesc}
                      iconVariant="discover"
                      title={t.chatSearchNoResults}
                    />
                  </View>
                )
              ) : (
                <ScrollView
                  className="flex-1"
                  contentContainerStyle={{ paddingBottom: insets.bottom + 48, paddingTop: 4 }}
                  keyboardDismissMode="on-drag"
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <>
                    <View className="px-4 pb-3 pt-1">
                      <View className="mb-2 flex-row items-center justify-between px-1">
                        <Text
                          className="text-[11px] font-semibold uppercase tracking-[1.4px]"
                          style={{ color: colors.secondaryText }}
                        >
                          {t.chatSidebarTags}
                        </Text>
                        <Text
                          className="text-[11px] font-medium"
                          style={{ color: colors.secondaryText }}
                        >
                          {activeTagFilterCount}/{topicCount}
                        </Text>
                      </View>
                      <ScrollView
                        horizontal
                        contentContainerStyle={{ paddingRight: 4 }}
                        keyboardShouldPersistTaps="handled"
                        showsHorizontalScrollIndicator={false}
                      >
                        <View className="flex-row" style={{ gap: 8 }}>
                          {renderSidebarTagFilterChip({
                            count: topicCount,
                            filterId: SIDEBAR_TAG_FILTER_ALL,
                            label: t.homeAgentAll,
                          })}
                          {renderSidebarTagFilterChip({
                            color: colors.secondaryText,
                            count: tagTopicCounts.untaggedCount,
                            filterId: SIDEBAR_TAG_FILTER_NONE,
                            label: t.tagNone,
                          })}
                          {tags.map((tag) =>
                            renderSidebarTagFilterChip({
                              color: tag.color,
                              count: tagTopicCounts.counts.get(tag.id) ?? 0,
                              filterId: tag.id,
                              label: tag.name,
                            }),
                          )}
                        </View>
                      </ScrollView>
                      {tags.length === 0 ? (
                        <TouchableOpacity
                          accessibilityLabel={t.tagCreate}
                          accessibilityRole="button"
                          activeOpacity={0.72}
                          className="mt-2.5 flex-row items-center rounded-xl px-2.5 py-2.5"
                          style={{ backgroundColor: withAlpha(colors.primary, '0a') }}
                          onPress={() => {
                            haptics.light();
                            openCreateTagEditor();
                          }}
                        >
                          <Tag
                            color={colors.primary}
                            size={16}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                          <Text
                            className="ml-2.5 flex-1 text-[12px] font-medium leading-[17px]"
                            style={{ color: colors.secondaryText }}
                          >
                            {t.chatSidebarTagsHint}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {pinnedSessions.length > 0 ? (
                      <SectionBlock compact title={t.groupPinned}>
                        {pinnedSessions.map((session) => renderAssistantRow(session, true))}
                      </SectionBlock>
                    ) : null}

                    {pinnedSessions.length > 0 && hasSidebarRecentsContent ? (
                      <View
                        className="mx-4 mb-1"
                        style={{
                          backgroundColor: colors.divider,
                          height: StyleSheet.hairlineWidth,
                        }}
                      />
                    ) : null}

                    {hasSidebarRecentsContent ? (
                      <SectionBlock compact title={t.homeRecents}>
                        {filteredInboxSession
                          ? renderAssistantRow(filteredInboxSession, true)
                          : null}
                        {filteredSessions
                          .slice(
                            0,
                            sidebarRecentsExpanded
                              ? filteredSessions.length
                              : SIDEBAR_RECENTS_VISIBLE,
                          )
                          .map((session) => renderAssistantRow(session, true))}
                        {filteredSessions.length > SIDEBAR_RECENTS_VISIBLE ? (
                          <TouchableOpacity
                            accessibilityRole="button"
                            activeOpacity={0.78}
                            className="mx-4 mb-0.5 mt-0.5 items-center rounded-xl py-3"
                            style={{
                              backgroundColor: colors.fillTertiary,
                              borderColor: colors.borderSubtle,
                              borderWidth: 1,
                            }}
                            onPress={() => {
                              haptics.light();
                              setSidebarRecentsExpanded((expanded) => !expanded);
                            }}
                          >
                            <Text
                              className="text-[13px] font-semibold"
                              style={{ color: colors.primary }}
                            >
                              {sidebarRecentsExpanded
                                ? t.chatSidebarRecentsShowLess
                                : t.chatSidebarRecentsShowAll.replace(
                                    '{count}',
                                    String(filteredSessions.length),
                                  )}
                            </Text>
                          </TouchableOpacity>
                        ) : null}
                      </SectionBlock>
                    ) : null}

                    {!loading &&
                    !hasFilteredSidebarSessions &&
                    activeTagFilterId === SIDEBAR_TAG_FILTER_ALL ? (
                      <EmptyState
                        compact
                        className="px-3 py-4"
                        description={t.chatSidebarEmptyDesc}
                        iconVariant="chat"
                        title={t.chatSidebarEmptyTitle}
                        action={
                          <TouchableOpacity
                            accessibilityLabel={t.chatListNewConversation}
                            accessibilityRole="button"
                            activeOpacity={0.85}
                            className="items-center self-center rounded-full px-6 py-3"
                            style={{ backgroundColor: colors.primary }}
                            onPress={() => {
                              haptics.light();
                              setDirectoryVisible(false);
                              void handleCreateChat();
                            }}
                          >
                            <Text
                              className="text-[15px] font-semibold"
                              style={{ color: colors.iconOnPrimary }}
                            >
                              {t.chatListNewConversation}
                            </Text>
                          </TouchableOpacity>
                        }
                      />
                    ) : null}

                    {!loading &&
                    !hasFilteredSidebarSessions &&
                    activeTagFilterId !== SIDEBAR_TAG_FILTER_ALL ? (
                      <View className="px-4">
                        <View
                          className="items-center rounded-[28px] px-5 py-8"
                          style={{
                            backgroundColor: colors.fillQuaternary,
                            borderColor: colors.borderSubtle,
                            borderWidth: 1,
                          }}
                        >
                          <View
                            className="h-12 w-12 items-center justify-center rounded-2xl"
                            style={{ backgroundColor: colors.surfaceElevated }}
                          >
                            <Tag
                              color={colors.primary}
                              size={20}
                              strokeWidth={tokens.icon.strokeWidth}
                            />
                          </View>
                          <Text className="mt-4 text-[16px] font-semibold text-foreground">
                            {activeTagFilterLabel}
                          </Text>
                          <Text
                            className="mt-2 text-center text-[13px] leading-5"
                            style={{ color: colors.secondaryText }}
                          >
                            {t.chatSidebarTagEmpty}
                          </Text>
                          <TouchableOpacity
                            activeOpacity={0.82}
                            className="mt-4 rounded-full px-4 py-2.5"
                            style={{ backgroundColor: colors.primarySubtle }}
                            onPress={() => {
                              haptics.light();
                              setActiveTagFilterId(SIDEBAR_TAG_FILTER_ALL);
                            }}
                          >
                            <Text
                              className="text-[13px] font-semibold"
                              style={{ color: colors.primary }}
                            >
                              {t.homeAgentAll}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    {loading && !hasFilteredSidebarSessions ? <ListSkeleton /> : null}
                  </>
                </ScrollView>
              )}
            </Animated.View>
          </GestureDetector>
        </View>
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

      <ModelDrawer visible={modelDrawerVisible} onClose={() => setModelDrawerVisible(false)} />
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
        onOpenStore={() => navigation.navigate('Store')}
        onToggle={handleToggleSkill}
      />
      <TagEditorSheet
        cancelLabel={t.cancel}
        color={tagDraftColor}
        colorLabel={t.tagColor}
        deleteDescription={tagEditingTarget ? t.tagDeleteDesc : undefined}
        deleteLabel={tagEditingTarget ? t.tagDeleteConfirm : undefined}
        name={tagDraftName}
        placeholder={t.tagPlaceholder}
        submitLabel={tagEditingTarget ? t.save : t.tagCreate}
        title={tagEditingTarget ? t.tagEdit : t.tagCreate}
        visible={tagEditorVisible}
        onCancel={closeTagEditor}
        onChangeColor={setTagDraftColor}
        onChangeName={setTagDraftName}
        onDelete={tagEditingTarget ? handleDeleteTag : undefined}
        onSubmit={() => void handleSubmitTag()}
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
                  <Text className="text-base font-medium" style={{ color: colors.secondaryText }}>
                    {t.cancel}
                  </Text>
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
            await handleTopicRename(topicRenameTarget.topicId, topicRenameTarget.sessionId, value);
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
        <Pressable className="flex-1 justify-end bg-black/40" onPress={closeTopicActionSheet}>
          <Pressable className="bg-card rounded-t-2xl pb-8" onPress={(e) => e.stopPropagation()}>
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
                    void handleTopicSmartRename(
                      topicActionTarget.topicId,
                      topicActionTarget.sessionId,
                    );
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
                      backgroundColor: isSelected
                        ? withAlpha(colors.primary, '14')
                        : colors.fillTertiary,
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
                        isGroup={false}
                        isInbox={session.id === visibleInboxSession?.id}
                        provider={providerId}
                        size={38}
                      />
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="text-[15px] font-semibold text-foreground" numberOfLines={1}>
                        {getSessionDisplayTitle(session)}
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
                      <Check
                        color={colors.primary}
                        size={18}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
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
