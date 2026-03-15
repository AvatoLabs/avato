/**
 * ChatListScreen → AI Command Surface with grouped sessions.
 *
 * Shows: HeroComposer, QuickActions, Pinned, Custom Groups, Default sessions.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  BotIcon,
  FolderOpen,
  ImageIcon,
  MessageSquarePlus,
  Pencil,
  PenLineIcon,
  Pin,
  Search,
  Trash2,
  UsersIcon,
} from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image as RNImage,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useShallow } from 'zustand/shallow';

import FilePreview from '../components/ui/FilePreview';
import { HeroComposer } from '../components/ui/HeroComposer';
import MemoryToolSheet from '../components/ui/MemoryToolSheet';
import { ModelDrawer } from '../components/ui/ModelDrawer';
import PromptModal from '../components/ui/PromptModal';
import { QuickActionRow } from '../components/ui/QuickActionRow';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionBlock } from '../components/ui/SectionBlock';
import SessionGroupHeader from '../components/ui/SessionGroupHeader';
import SwipeableRow from '../components/ui/SwipeableRow';
import { useToast } from '../components/ui/Toast';
import { getProviderIconUrl } from '../constants/cdn';
import { semanticColors } from '../constants/colors';
import { agentApi, pluginApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { getStreak, recordUsage } from '../lib/streak';
import { useChatStore } from '../store/chat';
import { useFileStore } from '../store/file';
import { useModelStore } from '../store/model';
import { useSessionStore } from '../store/session';
import { useSessionGroupStore } from '../store/sessionGroup';
import { tokens } from '../theme/tokens';
import type { ChatSession, InstalledPlugin, MobileMemoryEffort } from '../types';

type RelativeTimeText = {
  relativeTimeDays: string;
  relativeTimeHours: string;
  relativeTimeMinutes: string;
  relativeTimeNow: string;
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

  useEffect(() => {
    setImgError(false);
  }, [iconUrl]);

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
    if (avatar.length <= 4 && !avatar.startsWith('http')) {
      return (
        <View
          className="rounded-full bg-foreground/5 items-center justify-center"
          style={{ width: size, height: size }}
        >
          <Text style={{ fontSize: size * 0.6 }}>{avatar}</Text>
        </View>
      );
    }

    return (
      <View
        className="rounded-full bg-foreground/5 items-center justify-center overflow-hidden"
        style={{ width: size, height: size }}
      >
        <Image source={{ uri: avatar }} style={{ width: size, height: size }} />
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

  const { sessions, initialized } = useSessionStore(
    useShallow((s) => ({
      sessions: s.sessions,
      initialized: s.initialized,
    })),
  );
  const fetchSessions = useSessionStore((s) => s.fetchSessions);
  const createSession = useSessionStore((s) => s.createSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const pinSession = useSessionStore((s) => s.pinSession);
  const unpinSession = useSessionStore((s) => s.unpinSession);
  const moveToGroup = useSessionStore((s) => s.moveToGroup);
  const renameSession = useSessionStore((s) => s.renameSession);

  const groups = useSessionGroupStore((s) => s.groups);
  const fetchGroups = useSessionGroupStore((s) => s.fetchGroups);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const [heroText, setHeroText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [actionSession, setActionSession] = useState<ChatSession | null>(null);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [memoryEffort, setMemoryEffort] = useState<MobileMemoryEffort>('medium');
  const [memorySheetVisible, setMemorySheetVisible] = useState(false);
  const [modelDrawerVisible, setModelDrawerVisible] = useState(false);
  const [draftSessionId, setDraftSessionId] = useState<string | null>(null);

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

  // Load persisted expand/collapse state
  useEffect(() => {
    AsyncStorage.getItem('avato_expanded_groups').then((val) => {
      if (val) {
        try {
          setExpandedGroups(JSON.parse(val));
        } catch {
          /* ignore */
        }
      }
    });
  }, []);

  useEffect(() => {
    if (!initialized) fetchSessions();
    fetchGroups();
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
  }, [initialized, fetchSessions, fetchGroups]);

  // Re-read sessions (with AsyncStorage provider overlay) whenever the screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (initialized) fetchSessions();
    }, [initialized, fetchSessions]),
  );

  // Pre-load models and selection
  useEffect(() => {
    fetchModels();
    loadSelection();
  }, [fetchModels, loadSelection]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchSessions(), fetchGroups()]);
      haptics.success();
    } catch {
      toast.show('error', t.errorNetwork);
    }
    setRefreshing(false);
  }, [fetchSessions, fetchGroups, toast, t]);

  const handleCreateChat = async () => {
    const newId = draftSessionId || (await createSession());
    setDraftSessionId(null);
    haptics.success();
    navigation.navigate('ChatDetail', { sessionId: newId });
  };

  const handleHeroSubmit = async () => {
    const prompt = heroText.trim();
    const hasAttachment = pendingFiles.length > 0;
    if (!prompt && !hasAttachment) return;

    const sessionTitle = (prompt || pendingFiles[0]?.name || t.chatListNewConversation).slice(
      0,
      50,
    );
    const newId =
      draftSessionId ||
      (await createSession({
        title: sessionTitle,
        model: selectedModel || undefined,
        provider: selectedProvider || undefined,
        plugins: enabledSkills.size > 0 ? [...enabledSkills] : undefined,
      }));
    setDraftSessionId(null);

    try {
      const agentConfig = await agentApi.getConfigBySession(newId);
      if (agentConfig?.id) {
        await agentApi.updateConfig(agentConfig.id, {
          chatConfig: {
            memory: { effort: memoryEffort, enabled: memoryEnabled },
            searchMode: searchEnabled ? 'on' : 'off',
          },
        });
      }
    } catch {
      /* best-effort */
    }

    navigation.navigate('ChatDetail', { sessionId: newId });
    void sendMessage(newId, prompt, undefined, {
      memoryEffort,
      memoryEnabled,
      searchEnabled,
    });
    setHeroText('');
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

  const handleAttach = useCallback(() => {
    const pickImage = async (source: 'camera' | 'gallery') => {
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
          toast.show('success', t.toastFilePicked);
        }
      } catch {
        // user cancelled permission/system prompt, ignore to avoid unhandled rejection
      }
    };

    const pickDocument = async () => {
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
          toast.show('success', t.toastFilePicked);
        }
      } catch {
        // ignore
      }
    };

    haptics.selection();
    if (Platform.OS === 'ios') {
      const options = modelSupportsVision
        ? [t.cancel, t.fileCamera, t.fileGallery, t.fileDocument]
        : [t.cancel, t.fileDocument];
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 0, title: t.fileAttach },
        (index) => {
          if (modelSupportsVision) {
            if (index === 1) void pickImage('camera');
            else if (index === 2) void pickImage('gallery');
            else if (index === 3) void pickDocument();
          } else if (index === 1) {
            void pickDocument();
          }
        },
      );
    } else {
      if (modelSupportsVision) {
        Alert.alert(t.fileAttach, undefined, [
          { text: t.fileCamera, onPress: () => void pickImage('camera') },
          { text: t.fileGallery, onPress: () => void pickImage('gallery') },
          { text: t.fileDocument, onPress: () => void pickDocument() },
          { text: t.cancel, style: 'cancel' },
        ]);
      } else {
        Alert.alert(t.fileAttach, undefined, [
          { text: t.fileDocument, onPress: () => void pickDocument() },
          { text: t.cancel, style: 'cancel' },
        ]);
      }
    }
  }, [addFile, modelSupportsVision, t, toast]);

  // ── Skills drawer ─────────────────────────────────────────────────
  const [skillsVisible, setSkillsVisible] = useState(false);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [enabledSkills, setEnabledSkills] = useState<Set<string>>(new Set());

  const handlePluginsPress = useCallback(() => {
    haptics.light();
    setSkillsVisible(true);
    setLoadingSkills(true);
    pluginApi
      .list()
      .then((list) => {
        const plugins = list ?? [];
        setInstalledPlugins(plugins);
        setEnabledSkills(new Set(plugins.map((p) => p.identifier)));
      })
      .catch(() => {})
      .finally(() => setLoadingSkills(false));
  }, []);

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

  const handleQuickAction = async (key: string) => {
    if (key === 'group') {
      navigation.navigate('SessionGroup');
      return;
    }
    if (key === 'image') {
      navigation.navigate('Artwork');
      return;
    }
    // 'agent' and 'write' both create a session via unified path
    haptics.success();
    const newId = await createSession();
    navigation.navigate('ChatDetail', { sessionId: newId });
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      AsyncStorage.setItem('avato_expanded_groups', JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  // Filter sessions by search text
  const filteredSessions = useMemo(() => {
    if (!searchText.trim()) return sessions;
    const q = searchText.trim().toLowerCase();
    return sessions.filter(
      (s) => s.title?.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q),
    );
  }, [sessions, searchText]);

  // Organize sessions by group
  const { pinnedSessions, groupedSessions, defaultSessions } = useMemo(() => {
    const pinned = filteredSessions.filter((s) => s.pinned);
    const grouped: Record<string, ChatSession[]> = {};
    groups.forEach((g) => {
      grouped[g.id] = [];
    });

    const def: ChatSession[] = [];
    filteredSessions.forEach((s) => {
      if (s.pinned) return;
      if (s.groupId && grouped[s.groupId]) {
        grouped[s.groupId].push(s);
      } else {
        def.push(s);
      }
    });

    return { pinnedSessions: pinned, groupedSessions: grouped, defaultSessions: def };
  }, [filteredSessions, groups]);

  const handleLongPress = useCallback((session: ChatSession) => {
    haptics.medium();
    setActionSession(session);
  }, []);

  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [renameTarget, setRenameTarget] = useState<ChatSession | null>(null);

  const handleRename = useCallback((session: ChatSession) => {
    setActionSession(null);
    setRenameTarget(session);
    setTimeout(() => setRenameModalVisible(true), 300);
  }, []);

  const handleMoveToGroup = useCallback(
    (session: ChatSession) => {
      setActionSession(null);
      const options = [
        { text: t.groupDefault, onPress: () => moveToGroup(session.id, '') },
        ...groups.map((g) => ({
          text: g.name,
          onPress: () => moveToGroup(session.id, g.id),
        })),
        { text: t.cancel, style: 'cancel' as const },
      ];
      Alert.alert(t.groupMoveSession, undefined, options);
    },
    [groups, t, moveToGroup],
  );

  const quickActions = [
    { key: 'agent', label: t.homeQuickCode, icon: BotIcon },
    { key: 'group', label: t.homeQuickAnalyze, icon: UsersIcon },
    { key: 'write', label: t.homeQuickWrite, icon: PenLineIcon },
    { key: 'image', label: t.homeQuickCreate, icon: ImageIcon },
  ];

  const selectedProviderLogo = selectedProvider ? providerLogoById[selectedProvider] : undefined;

  const renderSessionRow = (item: ChatSession) => {
    const providerId = item.provider || (item.model ? modelToProvider[item.model] : undefined);
    const providerLogo = providerId ? providerLogoById[providerId] : undefined;

    return (
      <SwipeableRow
        key={item.id}
        pinLabel={item.pinned ? t.actionUnpin : t.actionPin}
        onDelete={() => {
          Alert.alert(t.deleteSessionConfirm, t.deleteSessionDesc, [
            { text: t.cancel, style: 'cancel' },
            {
              text: t.delete,
              style: 'destructive',
              onPress: () => {
                haptics.warning();
                removeSession(item.id);
                toast.show('info', t.toastSessionDeleted);
              },
            },
          ]);
        }}
        onPin={() => {
          haptics.light();
          if (item.pinned) {
            unpinSession(item.id);
            toast.show('success', t.toastUnpinned);
          } else {
            pinSession(item.id);
            toast.show('success', t.toastPinned);
          }
        }}
      >
        <TouchableOpacity
          accessibilityLabel={item.title}
          accessibilityRole="button"
          activeOpacity={0.4}
          className="flex-row items-start px-5 py-3 active:bg-foreground/10"
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
            <View className="flex-row items-center mb-0.5">
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
            </View>
            <Text className="text-secondary/40 text-[12px] font-medium" numberOfLines={1}>
              {item.description}
            </Text>
          </View>
          <Text className="text-gray-400 text-[10px] font-medium tracking-wide">
            {formatTimeAgo(item.updatedAt, t)}
          </Text>
        </TouchableOpacity>
      </SwipeableRow>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={greeting}
        rightElement={
          <MessageSquarePlus
            color={semanticColors.primary}
            size={20}
            strokeWidth={tokens.icon.strokeWidth}
          />
        }
        subtitle={
          sessions.length > 0
            ? t.activeChats.replace('{count}', String(sessions.length))
            : undefined
        }
        onPressRight={handleCreateChat}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 30 }}
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
              <Text className="text-secondary/60 text-[13px] font-medium px-6 mb-2">
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
              <View className="mx-4 -mt-2 mb-2 px-3 py-2 rounded-2xl bg-foreground/5">
                <FilePreview />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(75).duration(350)}>
          <View className="px-5 mt-2 mb-1">
            <View className="flex-row items-center bg-foreground/5 rounded-xl px-3.5 py-2.5">
              <Search
                color={semanticColors.muted}
                size={16}
                strokeWidth={tokens.icon.strokeWidth}
              />
              <TextInput
                className="flex-1 ml-2.5 text-foreground text-[14.5px]"
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

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(100).duration(350)}>
          <QuickActionRow actions={quickActions} onPress={handleQuickAction} />
        </Animated.View>

        {/* Pinned Sessions */}
        {pinnedSessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).duration(350)}>
            <SectionBlock title={t.groupPinned}>
              {pinnedSessions.map(renderSessionRow)}
            </SectionBlock>
          </Animated.View>
        )}

        {/* Custom Groups */}
        {groups.map((group) => {
          const groupSessions = groupedSessions[group.id] || [];
          const expanded = expandedGroups[group.id] !== false; // default expanded
          return (
            <Animated.View entering={FadeInDown.delay(200).duration(350)} key={group.id}>
              <SessionGroupHeader
                count={groupSessions.length}
                expanded={expanded}
                title={group.name}
                onToggle={() => toggleGroup(group.id)}
              />
              {expanded && groupSessions.map(renderSessionRow)}
            </Animated.View>
          );
        })}

        {/* Default / Ungrouped Sessions */}
        {defaultSessions.length > 0 && (
          <Animated.View entering={FadeInDown.delay(250).duration(350)}>
            <SectionBlock
              action={defaultSessions.length > 5 ? t.homeSeeAll : undefined}
              title={t.homeRecents}
            >
              {defaultSessions.slice(0, 10).map(renderSessionRow)}
            </SectionBlock>
          </Animated.View>
        )}
      </ScrollView>

      {/* Session Action Sheet */}
      <Modal
        transparent
        animationType="slide"
        visible={!!actionSession}
        onRequestClose={() => setActionSession(null)}
      >
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setActionSession(null)}
        >
          <Pressable className="bg-white rounded-t-2xl pb-8" onPress={(e) => e.stopPropagation()}>
            <View className="items-center pt-3 pb-2">
              <View className="w-9 h-1 rounded-full bg-neutral-300" />
            </View>
            <View className="px-4">
              {/* Pin/Unpin */}
              <Pressable
                className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                onPress={() => {
                  if (actionSession) {
                    haptics.light();
                    if (actionSession.pinned) {
                      unpinSession(actionSession.id);
                      toast.show('success', t.toastUnpinned);
                    } else {
                      pinSession(actionSession.id);
                      toast.show('success', t.toastPinned);
                    }
                  }
                  setActionSession(null);
                }}
              >
                <Pin
                  color={semanticColors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text className="ml-3 text-base text-neutral-800">
                  {actionSession?.pinned ? t.actionUnpin : t.actionPin}
                </Text>
              </Pressable>

              {/* Rename */}
              <Pressable
                className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                onPress={() => actionSession && handleRename(actionSession)}
              >
                <Pencil
                  color={semanticColors.primary}
                  size={18}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                <Text className="ml-3 text-base text-neutral-800">{t.actionRename}</Text>
              </Pressable>

              {/* Move to Group */}
              <Pressable
                className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                onPress={() => actionSession && handleMoveToGroup(actionSession)}
              >
                <FolderOpen color="#f5a623" size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-3 text-base text-neutral-800">{t.groupMoveSession}</Text>
              </Pressable>

              {/* Delete */}
              <Pressable
                className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                onPress={() => {
                  if (actionSession) {
                    setActionSession(null);
                    Alert.alert(t.deleteSessionConfirm, t.deleteSessionDesc, [
                      { text: t.cancel, style: 'cancel' },
                      {
                        text: t.delete,
                        style: 'destructive',
                        onPress: () => {
                          haptics.warning();
                          removeSession(actionSession.id);
                          toast.show('info', t.toastSessionDeleted);
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

            <View className="px-4 mt-2">
              <Pressable
                className="items-center py-3.5 rounded-xl bg-neutral-100"
                onPress={() => setActionSession(null)}
              >
                <Text className="text-base font-medium text-neutral-500">{t.cancel}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <PromptModal
        defaultValue={renameTarget?.title ?? ''}
        submitLabel={t.save}
        title={t.sessionRenameTitle}
        visible={renameModalVisible}
        onCancel={() => setRenameModalVisible(false)}
        onSubmit={(newName) => {
          setRenameModalVisible(false);
          if (renameTarget) {
            haptics.success();
            renameSession(renameTarget.id, newName);
            toast.show('success', t.sessionRenamed);
          }
        }}
      />

      {/* Model Drawer */}
      <ModelDrawer
        sessionId={draftSessionId ?? undefined}
        visible={modelDrawerVisible}
        onClose={() => setModelDrawerVisible(false)}
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

      {/* Skills Drawer */}
      <Modal
        transparent
        animationType="slide"
        visible={skillsVisible}
        onRequestClose={() => setSkillsVisible(false)}
      >
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
          onPress={() => setSkillsVisible(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl max-h-[70%]"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-1">
              <View className="w-10 h-1 rounded-full bg-black/10" />
            </View>
            <View className="px-5 pb-3 pt-2 flex-row items-center justify-between">
              <Text className="text-foreground text-[18px] font-bold tracking-tight">
                {t.skillsTitle}
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  setSkillsVisible(false);
                  navigation.navigate('Skills');
                }}
              >
                <Text className="text-primary text-[14px] font-medium">{t.skillsConfigure}</Text>
              </TouchableOpacity>
            </View>
            <ScrollView className="px-5 pb-8" style={{ maxHeight: 400 }}>
              {loadingSkills ? (
                <View className="items-center py-10">
                  <ActivityIndicator color={semanticColors.primary} size="small" />
                </View>
              ) : installedPlugins.length === 0 ? (
                <View className="items-center py-10">
                  <Text className="text-secondary/50 text-[14px]">{t.skillsEmpty}</Text>
                  <Text className="text-secondary/40 text-[12px] mt-1 text-center px-4">
                    {t.skillsEmptyDesc}
                  </Text>
                </View>
              ) : (
                installedPlugins.map((plugin) => (
                  <View
                    className="flex-row items-center py-3.5 border-b border-black/[0.04]"
                    key={plugin.identifier}
                  >
                    <View className="flex-1 mr-3">
                      <Text
                        className="text-foreground text-[15px] font-medium tracking-tight"
                        numberOfLines={1}
                      >
                        {plugin.manifest?.meta?.title || plugin.identifier}
                      </Text>
                      {plugin.manifest?.meta?.description ? (
                        <Text className="text-secondary/50 text-[12px] mt-0.5" numberOfLines={1}>
                          {plugin.manifest.meta.description}
                        </Text>
                      ) : null}
                    </View>
                    <Switch
                      trackColor={{ false: '#e5e5e5', true: semanticColors.primary }}
                      value={enabledSkills.has(plugin.identifier)}
                      onValueChange={() => handleToggleSkill(plugin.identifier)}
                    />
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
