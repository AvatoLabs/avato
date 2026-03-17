/**
 * ChatListScreen → AI Command Surface backed by server sessions.
 *
 * Shows: HeroComposer, pinned sessions, and recent sessions.
 */
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  MessageCircle,
  MessageSquarePlus,
  Pencil,
  Pin,
  Search,
  Tag,
  Trash2,
  UsersRound,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image as RNImage,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown, SlideInRight, SlideOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/shallow';

import AgentSelectionSheet from '../components/ui/AgentSelectionSheet';
import AttachmentSheet from '../components/ui/AttachmentSheet';
import EmptyState from '../components/ui/EmptyState';
import FilePreview from '../components/ui/FilePreview';
import { HeroComposer } from '../components/ui/HeroComposer';
import ListSkeleton from '../components/ui/ListSkeleton';
import MemoryToolSheet from '../components/ui/MemoryToolSheet';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import PromptModal from '../components/ui/PromptModal';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionBlock } from '../components/ui/SectionBlock';
import SkillsSheet from '../components/ui/SkillsSheet';
import { TagEditorSheet } from '../components/ui/TagEditorSheet';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import { semanticColors } from '../constants/colors';
import type { MobileRecommendedBuiltinIcon } from '../constants/recommendedBuiltins';
import { MOBILE_RECOMMENDED_BUILTIN_SKILLS } from '../constants/recommendedBuiltins';
import { resolveTagColor, withAlpha } from '../constants/tags';
import {
  agentApi,
  agentGroupApi,
  agentSkillApi,
  messageApi,
  type MessageSearchResult,
  pluginApi,
  sessionApi,
  sessionTagApi,
  topicApi,
  userApi,
} from '../lib/api';
import { classifyError } from '../lib/errorHandler';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useResolvedRemoteAsset } from '../lib/remoteAsset';
import { getStreak, recordUsage } from '../lib/streak';
import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useModelStore } from '../store/model';
import { useSessionStore } from '../store/session';
import { getUserMemorySettings } from '../store/user';
import { tokens } from '../theme/tokens';
import type {
  AgentSkillItem,
  ChatSession,
  InstalledPlugin,
  MobileMemoryEffort,
  SessionTag,
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

interface ChatFilterPill {
  color?: string | null;
  count: number;
  key: string;
  label: string;
  tagId?: string;
}

const ALL_CHATS_PILL_KEY = 'all';
const TAG_PILL_PREFIX = 'tag:';

const getTagPillKey = (tagId: string) => `${TAG_PILL_PREFIX}${tagId}`;

const sortSessionTags = (tags: SessionTag[]) =>
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
  provider,
  providerLogo,
  avatar,
  size = 36,
}: {
  avatar?: string;
  provider?: string;
  providerLogo?: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const iconSize = size * 0.65;
  const iconUrl = providerLogo || (provider ? getProviderIconUrl(provider) : undefined);
  const resolvedAvatarUri = useResolvedRemoteAsset(avatar);

  useEffect(() => {
    setImgError(false);
  }, [iconUrl, resolvedAvatarUri]);

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
        <Text className="text-foreground/60 font-semibold" style={{ fontSize: size * 0.35 }}>
          {provider.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  if (avatar) {
    // If it's an emoji (length <= 4 and not a URL), render as text
    if (avatar.length <= 4 && !resolvedAvatarUri) {
      return (
        <View
          className="rounded-full bg-foreground/5 items-center justify-center"
          style={{ width: size, height: size }}
        >
          <Text style={{ fontSize: size * 0.6 }}>{avatar}</Text>
        </View>
      );
    }

    if (resolvedAvatarUri) {
      return (
        <View
          className="rounded-full bg-foreground/5 items-center justify-center overflow-hidden"
          style={{ width: size, height: size }}
        >
          <Image source={{ uri: resolvedAvatarUri }} style={{ width: size, height: size }} />
        </View>
      );
    }

    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Text className="text-foreground/60 font-semibold" style={{ fontSize: size * 0.35 }}>
          {avatar.slice(0, 2).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="rounded-full bg-foreground/5 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text className="text-foreground/60 font-semibold" style={{ fontSize: size * 0.55 }}>
        #
      </Text>
    </View>
  );
}

export default function ChatListScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { t } = useI18n();
  const toast = useToast();

  // Dynamic greeting based on time of day + active chat count
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    let base: string;
    if (hour >= 6 && hour < 12) base = t.greetingMorning;
    else if (hour >= 12 && hour < 18) base = t.greetingAfternoon;
    else if (hour >= 18 && hour < 22) base = t.greetingEvening;
    else base = t.greetingNight;
    return base;
  }, [t]);

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
  const createSession = useSessionStore((s) => s.createSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const pinSession = useSessionStore((s) => s.pinSession);
  const unpinSession = useSessionStore((s) => s.unpinSession);
  const renameSession = useSessionStore((s) => s.renameSession);
  const updateSessionTag = useSessionStore((s) => s.updateSessionTag);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [heroText, setHeroText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<SearchSessionResult[]>([]);
  const [sessionTags, setSessionTags] = useState<SessionTag[]>([]);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [actionSession, setActionSession] = useState<ChatSession | null>(null);
  const [actionPanel, setActionPanel] = useState<'root' | 'move-tag'>('root');
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const [createGroupSheetVisible, setCreateGroupSheetVisible] = useState(false);
  const [tagEditorVisible, setTagEditorVisible] = useState(false);
  const [tagEditorTargetSessionId, setTagEditorTargetSessionId] = useState<string | null>(null);
  const [editingTag, setEditingTag] = useState<SessionTag | null>(null);
  const [tagDraftName, setTagDraftName] = useState('');
  const [tagDraftColor, setTagDraftColor] = useState<string | null>(null);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryEffort, setMemoryEffort] = useState<MobileMemoryEffort>('medium');
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false);
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ChatSession | null>(null);
  const [selectedPillKey, setSelectedPillKey] = useState<string>(ALL_CHATS_PILL_KEY);

  const pendingFiles = useFileStore((s) => s.pendingFiles);
  const selectedProvider = useModelStore((s) => s.selectedProvider);
  const selectedModel = useModelStore((s) => s.selectedModel);
  const modelProviders = useModelStore((s) => s.providers);
  const fetchModels = useModelStore((s) => s.fetchModels);
  const loadSelection = useModelStore((s) => s.loadSelection);
  const modelSupportsVision = useMemo(() => {
    if (!selectedModel || modelProviders.length === 0) return true;

    for (const provider of modelProviders) {
      if (selectedProvider && provider.id !== selectedProvider) continue;
      const model = provider.children.find((m) => m.id === selectedModel);
      if (model) return !!model.abilities?.vision;
    }

    return true;
  }, [modelProviders, selectedModel, selectedProvider]);

  const providerLogoById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const provider of modelProviders) {
      if (provider.logo) {
        map[provider.id] = provider.logo;
      }
    }
    return map;
  }, [modelProviders]);

  const modelToProvider = useMemo(() => {
    const map: Record<string, string> = {};
    for (const provider of modelProviders) {
      for (const model of provider.children) {
        if (!map[model.id]) {
          map[model.id] = provider.id;
        }
      }
    }
    return map;
  }, [modelProviders]);

  const fetchSessionTags = useCallback(
    async (showError = false) => {
      try {
        const tags = await sessionTagApi.list();
        setSessionTags(sortSessionTags(tags ?? []));
      } catch {
        if (showError) {
          toast.show('error', t.errorNetwork);
        }
      }
    },
    [t.errorNetwork, toast],
  );

  const tagById = useMemo(
    () => Object.fromEntries(sessionTags.map((tag) => [tag.id, tag])),
    [sessionTags],
  );
  const activeTagId = useMemo(
    () =>
      selectedPillKey.startsWith(TAG_PILL_PREFIX)
        ? selectedPillKey.slice(TAG_PILL_PREFIX.length)
        : undefined,
    [selectedPillKey],
  );

  const loadGlobalMemorySettings = useCallback(async () => {
    const settings = await getUserMemorySettings();

    setMemoryEnabled(settings.enabled);
    setMemoryEffort(settings.effort);
  }, []);

  useEffect(() => {
    if (!initialized) void fetchSessions();
    void fetchSessionTags();
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
    fetchSessionTags,
    fetchSessions,
    initialized,
    loadGlobalMemorySettings,
    t.streakCelebrate,
    toast,
  ]);

  // Re-read sessions (with AsyncStorage provider overlay) whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (initialized) {
        void fetchSessions();
      }
      void fetchSessionTags();
      void loadGlobalMemorySettings();
    }, [fetchSessionTags, initialized, fetchSessions, loadGlobalMemorySettings]),
  );

  useEffect(() => {
    if (!selectedPillKey.startsWith(TAG_PILL_PREFIX)) return;
    if (activeTagId && tagById[activeTagId]) return;
    setSelectedPillKey(ALL_CHATS_PILL_KEY);
  }, [activeTagId, selectedPillKey, tagById]);

  // Pre-load models and selection
  useEffect(() => {
    fetchModels();
    loadSelection();
  }, [fetchModels, loadSelection]);

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
      await Promise.all([fetchSessions(), fetchSessionTags()]);
      haptics.success();
    } catch {
      toast.show('error', t.errorNetwork);
    }
    setRefreshing(false);
  }, [fetchSessionTags, fetchSessions, toast, t]);

  const handleCreateChat = async () => {
    setCreateMenuVisible(false);
    try {
      const newId =
        draftSessionId ||
        (await createSession({
          tagId: activeTagId,
        }));
      setDraftSessionId(null);
      haptics.success();
      navigation.navigate('ChatDetail', { sessionId: newId });
    } catch {
      toast.show('error', t.errorNetwork);
    }
  };

  const handleHeroSubmit = async () => {
    const prompt = heroText.trim();
    const hasAttachment = pendingFiles.length > 0;
    if (!prompt && !hasAttachment) return;

    try {
      const newId =
        draftSessionId ||
        (await createSession({
          tagId: activeTagId,
          model: selectedModel || undefined,
          provider: selectedProvider || undefined,
          plugins: enabledSkills.size > 0 ? [...enabledSkills] : undefined,
        }));
      setDraftSessionId(null);

      const agentConfig = await agentApi.getConfigBySession(newId);
      const chatConfigUpdate = {
        chatConfig: {
          memory: { effort: memoryEffort, enabled: memoryEnabled },
          searchMode: searchEnabled ? 'on' : 'off',
        },
      };
      if (agentConfig?.id) {
        try {
          await agentApi.updateConfig(agentConfig.id, chatConfigUpdate);
        } catch {
          /* best-effort */
        }
      } else {
        try {
          await sessionApi.updateSessionConfig(newId, chatConfigUpdate);
        } catch {
          /* best-effort */
        }
      }

      void sendMessage(newId, prompt, undefined, {
        memoryEffort,
        memoryEnabled,
        searchEnabled,
      });
      setHeroText('');
      navigation.navigate('ChatDetail', { sessionId: newId });
    } catch {
      toast.show('error', t.errorNetwork);
    }
  };

  const handleModelPress = () => {
    haptics.light();
    setModelDrawerVisible(true);
  };

  const handleToggleSearch = () => {
    haptics.light();
    setSearchEnabled((v) => !v);
  };

  const handleToggleMemory = () => {
    haptics.light();
    setMemorySheetVisible(true);
  };

  const addFile = useFileStore((s) => s.addFile);

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
      } catch {
        /* ignore */
      }
    },
    [addFile],
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
    } catch {
      /* ignore */
    }
  }, [addFile]);

  const handleAttach = useCallback(() => {
    haptics.selection();
    setAttachmentSheetVisible(true);
  }, []);

  // ── Skills drawer ─────────────────────────────────────────────────
  const [skillsVisible, setSkillsVisible] = useState(false);
  const [builtinSkillItems, setBuiltinSkillItems] = useState<
    { description: string; icon: MobileRecommendedBuiltinIcon; identifier: string; title: string }[]
  >([]);
  const [agentSkillItems, setAgentSkillItems] = useState<AgentSkillItem[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [enabledSkills, setEnabledSkills] = useState<Set<string>>(() => new Set());

  const handlePluginsPress = useCallback(() => {
    haptics.light();
    setSkillsVisible(true);
    // Pre-load builtins immediately (same as ChatDetailScreen)
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
            if (attempt === 0) console.warn('[ChatListScreen] pluginApi.list failed:', e);
            return [];
          }),
          agentSkillApi.list().catch((e) => {
            if (attempt === 0) console.warn('[ChatListScreen] agentSkillApi.list failed:', e);
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

        const allIds = [
          ...builtins.map((b) => b.identifier),
          ...filteredSkills.map((s) => s.identifier ?? s.id).filter(Boolean),
          ...filteredPlugins.map((p) => p.identifier),
        ];
        setEnabledSkills(new Set(allIds));
      } catch (e) {
        console.warn('[ChatListScreen] loadSkills failed:', e);
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 400));
          return loadSkills(attempt + 1);
        }
      }
    };
    void loadSkills().finally(() => setLoadingSkills(false));
  }, [t]);

  const handleToggleSkill = useCallback((identifier: string) => {
    haptics.light();
    setEnabledSkills((prev) => {
      const next = new Set(prev);
      if (next.has(identifier)) {
        next.delete(identifier);
      } else {
        next.add(identifier);
      }
      return next;
    });
  }, []);

  const closeActionSheet = useCallback(() => {
    setActionPanel('root');
    setActionSession(null);
  }, []);

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

  const closeTagEditor = useCallback(() => {
    setEditingTag(null);
    setTagDraftName('');
    setTagDraftColor(null);
    setTagEditorTargetSessionId(null);
    setTagEditorVisible(false);
  }, []);

  const openCreateTag = useCallback((targetSessionId?: string | null) => {
    setEditingTag(null);
    setTagDraftName('');
    setTagDraftColor(null);
    setTagEditorTargetSessionId(targetSessionId ?? null);
    setTagEditorVisible(true);
  }, []);

  const openEditTag = useCallback((tag: SessionTag) => {
    haptics.light();
    setEditingTag(tag);
    setTagDraftName(tag.name);
    setTagDraftColor(tag.color ?? null);
    setTagEditorTargetSessionId(null);
    setTagEditorVisible(true);
  }, []);

  const handleSubmitTag = useCallback(async () => {
    const name = tagDraftName.trim();
    if (!name) {
      toast.show('error', t.errorUnknown);
      return;
    }

    const targetSessionId = tagEditorTargetSessionId;

    try {
      if (editingTag) {
        await sessionTagApi.update(editingTag.id, {
          color: tagDraftColor,
          name,
        });
        await fetchSessionTags(true);
        haptics.success();
        closeTagEditor();
        return;
      }

      const newTagId = await sessionTagApi.create(name, tagDraftColor);
      if (!newTagId) {
        toast.show('error', t.errorNetwork);
        return;
      }

      await fetchSessionTags(true);

      if (targetSessionId) {
        await updateSessionTag(targetSessionId, newTagId);
        closeActionSheet();
      }

      setSelectedPillKey(getTagPillKey(newTagId));
      haptics.success();
      closeTagEditor();
    } catch (err) {
      const { messageKey } = classifyError(err);
      toast.show('error', t[messageKey]);
    }
  }, [
    closeActionSheet,
    closeTagEditor,
    editingTag,
    fetchSessionTags,
    t,
    tagDraftColor,
    tagDraftName,
    tagEditorTargetSessionId,
    toast,
    updateSessionTag,
  ]);

  const handleDeleteTag = useCallback(async () => {
    if (!editingTag) return;

    try {
      await sessionTagApi.remove(editingTag.id);
      await Promise.all([fetchSessionTags(true), fetchSessions()]);
      if (activeTagId === editingTag.id) {
        setSelectedPillKey(ALL_CHATS_PILL_KEY);
      }
      haptics.success();
      closeTagEditor();
    } catch (err) {
      const { messageKey } = classifyError(err);
      toast.show('error', t[messageKey]);
    }
  }, [activeTagId, closeTagEditor, editingTag, fetchSessionTags, fetchSessions, t, toast]);

  const handleMoveSessionToTag = useCallback(
    async (tagId?: string | null) => {
      if (!actionSession) return;

      try {
        await updateSessionTag(actionSession.id, tagId);
        haptics.success();
        closeActionSheet();
      } catch (err) {
        const { messageKey } = classifyError(err);
        toast.show('error', t[messageKey]);
      }
    },
    [actionSession, closeActionSheet, t, toast, updateSessionTag],
  );

  const pillItems = useMemo<ChatFilterPill[]>(() => {
    const tagPills = sessionTags.map((tag) => ({
      color: tag.color,
      count: sessions.filter((session) => session.tagId === tag.id).length,
      key: getTagPillKey(tag.id),
      label: tag.name,
      tagId: tag.id,
    }));

    return [{ count: sessions.length, key: ALL_CHATS_PILL_KEY, label: t.chatListAll }, ...tagPills];
  }, [sessionTags, sessions, t.chatListAll]);

  const matchesSelectedPill = useCallback(
    (session: ChatSession) => {
      if (selectedPillKey === ALL_CHATS_PILL_KEY) return true;
      if (activeTagId) return session.tagId === activeTagId;
      return true;
    },
    [activeTagId, selectedPillKey],
  );

  const visibleSessions = useMemo(
    () => sessions.filter(matchesSelectedPill),
    [matchesSelectedPill, sessions],
  );

  const { pinnedSessions, filteredSessions } = useMemo(() => {
    const pinned = visibleSessions.filter((session) => session.pinned);
    const rest = visibleSessions.filter((session) => !session.pinned);
    return { pinnedSessions: pinned, filteredSessions: rest };
  }, [visibleSessions]);

  const filteredSearchResults = useMemo(
    () => searchResults.filter((result) => matchesSelectedPill(result.session)),
    [matchesSelectedPill, searchResults],
  );

  const handleCreateAgent = useCallback(async () => {
    setCreateMenuVisible(false);

    try {
      const result = await agentApi.create(undefined, activeTagId);
      if (!result?.sessionId) {
        toast.show('error', t.errorNetwork);
        return;
      }

      await fetchSessions();
      haptics.success();
      navigation.navigate('AgentConfig', { sessionId: result.sessionId });
    } catch {
      toast.show('error', t.errorNetwork);
    }
  }, [activeTagId, fetchSessions, navigation, t.errorNetwork, toast]);

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
        await fetchSessions();
        haptics.success();
        navigation.navigate('ChatDetail', { sessionId: result.group.id });
      } catch {
        toast.show('error', t.errorNetwork);
      }
    },
    [fetchSessions, navigation, t.errorNetwork, t.groupCreateDefaultTitle, toast],
  );

  const selectedProviderLogo = selectedProvider ? providerLogoById[selectedProvider] : undefined;

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

  const renderSessionRow = (item: ChatSession) => {
    const providerId = item.provider || (item.model ? modelToProvider[item.model] : undefined);
    const providerLogo = providerId ? providerLogoById[providerId] : undefined;

    return (
      <TouchableOpacity
        accessibilityLabel={item.title}
        accessibilityRole="button"
        activeOpacity={0.4}
        className="flex-row items-start px-5 py-3 active:bg-foreground/10"
        key={item.id}
        onLongPress={() => handleLongPress(item)}
        onPress={() => navigation.navigate('ChatDetail', { sessionId: item.id })}
      >
        <View className="w-10 h-10 rounded-full items-center justify-center mr-3.5 mt-0.5">
          <SessionLogo
            avatar={item.avatar}
            provider={providerId}
            providerLogo={providerLogo}
            size={36}
          />
        </View>
        <View className="flex-1 mr-3 mt-0.5">
          <View className="flex-row items-center mb-0.5 flex-wrap">
            {item.pinned && (
              <Pin
                color={semanticColors.primary}
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
            {renderTagChip(item.tagId)}
          </View>
          <Text className="text-secondary/40 text-[12px] font-medium" numberOfLines={1}>
            {item.description}
          </Text>
        </View>
        <Text className="text-secondary/40 text-[10px] font-medium tracking-wide">
          {formatTimeAgo(item.updatedAt, t)}
        </Text>
      </TouchableOpacity>
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
      session.provider || (session.model ? modelToProvider[session.model] : undefined);
    const providerLogo = providerId ? providerLogoById[providerId] : undefined;

    return (
      <TouchableOpacity
        accessibilityLabel={`${session.title || t.chatListNewConversation}, ${matchType === 'session' ? t.chatSearchMatchSession : matchType === 'topic' ? t.chatSearchMatchTopic : t.chatSearchMatchMessage}`}
        accessibilityRole="button"
        activeOpacity={0.65}
        className="flex-row items-start px-5 py-3"
        key={id}
        onPress={() =>
          navigation.navigate('ChatDetail', {
            messageId,
            sessionId: session.id,
            ...(topicId ? { topicId } : {}),
          })
        }
      >
        <View className="mr-3.5 mt-0.5 h-10 w-10 items-center justify-center rounded-full">
          <SessionLogo
            avatar={session.avatar}
            provider={providerId}
            providerLogo={providerLogo}
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
            <Text className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-secondary/35">
              {matchType === 'session'
                ? t.chatSearchMatchSession
                : matchType === 'topic'
                  ? t.chatSearchMatchTopic
                  : t.chatSearchMatchMessage}
            </Text>
            {renderTagChip(session.tagId)}
          </View>
          <Text className="text-[12px] font-medium leading-5 text-secondary/55" numberOfLines={2}>
            {summary}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const searchQuery = searchText.trim();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        subtitle={t.activeChats.replace('{count}', String(visibleSessions.length))}
        title={greeting}
        rightActions={
          <View className="flex-row items-center">
            <TouchableOpacity
              accessibilityLabel={t.accessibilityCreateMenu}
              activeOpacity={0.7}
              className="h-10 w-10 items-center justify-center"
              onPress={() => {
                haptics.light();
                setCreateMenuVisible(true);
              }}
            >
              <MessageSquarePlus
                color={semanticColors.primary}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </TouchableOpacity>
          </View>
        }
        titleIcon={
          <MessageCircle
            color={semanticColors.primary}
            size={20}
            strokeWidth={tokens.icon.strokeWidth}
          />
        }
      >
        <ScrollView
          horizontal
          className="pb-3"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
          showsHorizontalScrollIndicator={false}
        >
          {pillItems.map((pill) => {
            const selected = pill.key === selectedPillKey;
            const resolvedColor = pill.tagId ? resolveTagColor(pill.color) : semanticColors.primary;
            const selectedBackground = pill.tagId ? resolvedColor : semanticColors.primary;
            const unselectedBackground = pill.tagId
              ? withAlpha(pill.color, '16')
              : semanticColors.fillTertiary;
            const countBackground = selected
              ? withAlpha(selectedBackground, '33')
              : withAlpha(pill.color, '20');
            const editableTag = pill.tagId ? tagById[pill.tagId] : undefined;

            return (
              <TouchableOpacity
                activeOpacity={0.8}
                className="flex-row items-center rounded-full px-4 py-2"
                key={pill.key}
                style={{
                  backgroundColor: selected ? selectedBackground : unselectedBackground,
                }}
                onLongPress={editableTag ? () => openEditTag(editableTag) : undefined}
                onPress={() => {
                  haptics.selection();
                  setSelectedPillKey(pill.key);
                }}
              >
                <Text
                  className="text-[13px] font-semibold"
                  style={{
                    color: selected
                      ? '#fff'
                      : pill.tagId
                        ? resolvedColor
                        : semanticColors.foreground,
                  }}
                >
                  {pill.label}
                </Text>
                <View
                  className="ml-2 rounded-full px-2 py-0.5"
                  style={{ backgroundColor: countBackground }}
                >
                  <Text
                    className="text-[11px] font-semibold"
                    style={{
                      color: selected
                        ? '#fff'
                        : pill.tagId
                          ? resolvedColor
                          : semanticColors.secondaryText,
                    }}
                  >
                    {pill.count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </ScreenHeader>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            colors={[semanticColors.primary]}
            refreshing={refreshing}
            tintColor={semanticColors.primary}
            onRefresh={onRefresh}
          />
        }
      >
        {/* Hero Composer */}
        <Animated.View entering={FadeInDown.delay(50).duration(350)}>
          <View className="pt-3">
            {streak > 1 && (
              <Text className="text-secondary/60 text-[13px] font-medium px-5 mb-2">
                {streak >= 7 ? '🔥 ' : ''}
                {t.streakMessage.replace('{count}', String(streak))}
              </Text>
            )}
            <HeroComposer
              attachmentCount={pendingFiles.length}
              hasAttachment={pendingFiles.length > 0}
              memoryEnabled={memoryEnabled}
              modelProvider={selectedProvider || undefined}
              modelProviderLogo={selectedProviderLogo}
              placeholder={t.homeHeroPlaceholder}
              searchEnabled={searchEnabled}
              value={heroText}
              onAttach={handleAttach}
              onChangeText={setHeroText}
              onModelPress={handleModelPress}
              onPluginsPress={handlePluginsPress}
              onSubmit={handleHeroSubmit}
              onToggleMemory={handleToggleMemory}
              onToggleSearch={handleToggleSearch}
            />
            {pendingFiles.length > 0 && (
              <View className="mx-5 -mt-2 mb-2 px-3 py-2 rounded-2xl bg-foreground/5">
                <FilePreview sessionId={draftSessionId ?? undefined} />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(75).duration(350)}>
          <View className="px-5 mt-3 mb-2">
            <View className="flex-row items-center bg-foreground/5 rounded-xl px-3.5 py-2.5">
              <Search
                color={semanticColors.muted}
                size={16}
                strokeWidth={tokens.icon.strokeWidth}
              />
              <TextInput
                className="flex-1 ml-2.5 text-foreground text-[14px]"
                clearButtonMode="while-editing"
                placeholder={t.chatListSearch}
                placeholderTextColor={semanticColors.muted}
                returnKeyType="search"
                value={searchText}
                onChangeText={setSearchText}
              />
            </View>
          </View>
        </Animated.View>

        {searchQuery ? (
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            {searching ? (
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
            )}
          </Animated.View>
        ) : (
          <>
            {/* Pinned Sessions */}
            {pinnedSessions.length > 0 && (
              <Animated.View entering={FadeInDown.delay(100).duration(350)}>
                <SectionBlock title={t.groupPinned}>
                  {pinnedSessions.map(renderSessionRow)}
                </SectionBlock>
              </Animated.View>
            )}

            {/* Recent sessions */}
            {filteredSessions.length > 0 && (
              <Animated.View entering={FadeInDown.delay(150).duration(350)}>
                <SectionBlock title={t.homeRecents}>
                  {filteredSessions.slice(0, 20).map(renderSessionRow)}
                </SectionBlock>
              </Animated.View>
            )}

            {loading && visibleSessions.length === 0 ? (
              <ListSkeleton />
            ) : sessionErrorMessage && visibleSessions.length === 0 ? (
              <Animated.View entering={FadeInDown.delay(150).duration(350)}>
                <View className="items-center px-5 pb-4 pt-8">
                  <Text className="text-center text-[16px] font-semibold text-foreground">
                    {sessionErrorMessage}
                  </Text>
                  <Text className="mt-2 px-4 text-center text-[14px] font-medium text-secondary/60">
                    {t.chatListLoadFailed}
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    className="mt-4 rounded-full bg-primary px-4 py-2.5"
                    onPress={() => void onRefresh()}
                  >
                    <Text className="text-[13px] font-semibold text-white">{t.errorRetry}</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ) : null}

            {/* Empty state when no sessions at all (and not loading) */}
            {visibleSessions.length === 0 && !sessionErrorMessage && !loading && (
              <Animated.View entering={FadeInDown.delay(150).duration(350)}>
                <EmptyState description={t.chatListEmptyDesc} icon="💬" title={t.chatListEmpty} />
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>

      <Modal
        accessibilityViewIsModal
        transparent
        animationType="fade"
        visible={createMenuVisible}
        onRequestClose={() => setCreateMenuVisible(false)}
      >
        <Pressable className="flex-1 bg-black/10" onPress={() => setCreateMenuVisible(false)}>
          <Pressable
            className="absolute overflow-hidden rounded-2xl bg-card"
            style={{
              minWidth: 220,
              right: 16,
              top: insets.top + 52,
            }}
            onPress={(event) => event.stopPropagation()}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center px-4 py-3"
              onPress={handleCreateChat}
            >
              <MessageSquarePlus
                color={semanticColors.primary}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
              <Text className="ml-3 text-[15px] font-medium text-foreground">
                {t.chatListNewConversation}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center px-4 py-3"
              onPress={handleCreateAgent}
            >
              <Bot color={semanticColors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-[15px] font-medium text-foreground">
                {t.chatListCreateAgent}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center px-4 py-3"
              onPress={handleCreateGroup}
            >
              <UsersRound
                color={semanticColors.primary}
                size={18}
                strokeWidth={tokens.icon.strokeWidth}
              />
              <Text className="ml-3 text-[15px] font-medium text-foreground">
                {t.chatListCreateGroup}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-row items-center px-4 py-3"
              onPress={() => {
                setCreateMenuVisible(false);
                openCreateTag();
              }}
            >
              <Tag color={semanticColors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
              <Text className="ml-3 text-[15px] font-medium text-foreground">
                {t.chatListCreateTag}
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
                  <Pin
                    color={semanticColors.muted}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text className="ml-3 text-base text-foreground">
                    {actionSession?.pinned ? t.actionUnpin : t.actionPin}
                  </Text>
                </Pressable>

                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={() => actionSession && handleRename(actionSession)}
                >
                  <Pencil
                    color={semanticColors.muted}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text className="ml-3 text-base text-foreground">{t.actionRename}</Text>
                </Pressable>

                {actionSession?.type !== 'group' ? (
                  <Pressable
                    className="flex-row items-center justify-between py-3.5 px-3 rounded-xl active:bg-foreground/5"
                    onPress={() => {
                      haptics.light();
                      setActionPanel('move-tag');
                    }}
                  >
                    <View className="flex-row items-center">
                      <Tag
                        color={semanticColors.muted}
                        size={18}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                      <Text className="ml-3 text-base text-foreground">{t.tagMoveSession}</Text>
                    </View>
                    <ChevronRight
                      color={semanticColors.secondaryText}
                      size={16}
                      strokeWidth={tokens.icon.strokeWidth}
                    />
                  </Pressable>
                ) : null}

                <Pressable
                  className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                  onPress={() => {
                    if (actionSession) {
                      closeActionSheet();
                      Alert.alert(t.deleteSessionConfirm, t.deleteSessionDesc, [
                        { text: t.cancel, style: 'cancel' },
                        {
                          text: t.delete,
                          style: 'destructive',
                          onPress: () => {
                            haptics.warning();
                            removeSession(actionSession.id);
                          },
                        },
                      ]);
                    }
                  }}
                >
                  <Trash2
                    color={semanticColors.danger}
                    size={18}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                  <Text className="ml-3 text-base text-red-500">{t.delete}</Text>
                </Pressable>
              </View>

              <View className="px-5 mt-2">
                <Pressable
                  className="items-center py-3.5 rounded-xl bg-foreground/[0.04]"
                  onPress={closeActionSheet}
                >
                  <Text className="text-base font-medium text-foreground/50">{t.cancel}</Text>
                </Pressable>
              </View>

              {actionPanel === 'move-tag' && actionSession?.type !== 'group' ? (
                <Animated.View
                  className="absolute inset-0 bg-card"
                  entering={SlideInRight.duration(220)}
                  exiting={SlideOutRight.duration(180)}
                >
                  <View className="flex-row items-center justify-between px-5 pb-3 pt-1">
                    <TouchableOpacity
                      activeOpacity={0.7}
                      className="h-10 w-10 items-center justify-center"
                      onPress={() => setActionPanel('root')}
                    >
                      <ArrowLeft
                        color={semanticColors.primary}
                        size={18}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                    </TouchableOpacity>
                    <Text className="text-[16px] font-semibold text-foreground">
                      {t.tagMoveSession}
                    </Text>
                    <View className="h-10 w-10" />
                  </View>

                  <ScrollView className="px-5" contentContainerStyle={{ paddingBottom: 24 }}>
                    <Pressable
                      className="flex-row items-center justify-between rounded-xl px-3 py-3.5 active:bg-foreground/5"
                      onPress={() => void handleMoveSessionToTag(null)}
                    >
                      <View className="flex-row items-center">
                        <View
                          className="mr-3 h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: semanticColors.secondaryText }}
                        />
                        <Text className="text-[15px] font-medium text-foreground">{t.tagNone}</Text>
                      </View>
                      {!actionSession?.tagId ? (
                        <Check
                          color={semanticColors.primary}
                          size={18}
                          strokeWidth={tokens.icon.strokeWidth}
                        />
                      ) : null}
                    </Pressable>

                    {sessionTags.map((tag) => (
                      <Pressable
                        className="flex-row items-center justify-between rounded-xl px-3 py-3.5 active:bg-foreground/5"
                        key={tag.id}
                        onPress={() => void handleMoveSessionToTag(tag.id)}
                      >
                        <View className="flex-row items-center">
                          <View
                            className="mr-3 h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: resolveTagColor(tag.color) }}
                          />
                          <Text className="text-[15px] font-medium text-foreground">
                            {tag.name}
                          </Text>
                        </View>
                        {actionSession?.tagId === tag.id ? (
                          <Check
                            color={semanticColors.primary}
                            size={18}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                        ) : null}
                      </Pressable>
                    ))}

                    <Pressable
                      className="mt-2 flex-row items-center rounded-xl bg-foreground/[0.04] px-3 py-3.5 active:bg-foreground/10"
                      onPress={() => {
                        openCreateTag(actionSession?.id);
                      }}
                    >
                      <Tag
                        color={semanticColors.primary}
                        size={18}
                        strokeWidth={tokens.icon.strokeWidth}
                      />
                      <Text className="ml-3 text-[15px] font-medium text-primary">
                        {t.tagCreate}
                      </Text>
                    </Pressable>
                  </ScrollView>
                </Animated.View>
              ) : null}
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

      <TagEditorSheet
        cancelLabel={t.cancel}
        color={tagDraftColor}
        colorLabel={t.tagColor}
        deleteDescription={editingTag ? t.tagDeleteDesc : undefined}
        deleteLabel={editingTag ? t.delete : undefined}
        name={tagDraftName}
        placeholder={t.tagPlaceholder}
        submitLabel={t.save}
        title={editingTag ? t.tagEdit : t.tagCreate}
        visible={tagEditorVisible}
        onCancel={closeTagEditor}
        onChangeColor={setTagDraftColor}
        onChangeName={setTagDraftName}
        onDelete={editingTag ? () => void handleDeleteTag() : undefined}
        onSubmit={() => void handleSubmitTag()}
      />

      {/* Model Drawer */}
      <ModelDrawer
        sessionId={draftSessionId ?? undefined}
        visible={modelDrawerVisible}
        onClose={() => setModelDrawerVisible(false)}
      />

      <AttachmentSheet
        visible={attachmentSheetVisible}
        onCamera={modelSupportsVision ? () => void pickImage('camera') : undefined}
        onClose={() => setAttachmentSheetVisible(false)}
        onDocument={() => void pickDocument()}
        onGallery={modelSupportsVision ? () => void pickImage('gallery') : undefined}
      />

      <MemoryToolSheet
        effort={memoryEffort}
        enabled={memoryEnabled}
        visible={memorySheetVisible}
        onClose={() => setMemorySheetVisible(false)}
        onChangeEffort={(value) => {
          setMemoryEnabled(true);
          setMemoryEffort(value);
        }}
        onChangeEnabled={(value) => {
          setMemoryEnabled(value);
        }}
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
        onOpenStore={() => navigation.getParent()?.navigate('Store')}
        onToggle={handleToggleSkill}
      />
    </View>
  );
}
