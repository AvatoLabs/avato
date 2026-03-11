/**
 * ChatListScreen → AI Command Surface with grouped sessions.
 *
 * Shows: HeroComposer, QuickActions, Pinned, Custom Groups, Default sessions.
 */
import { Image } from 'expo-image';
import {
  Code2,
  FolderOpen,
  LineChart,
  MessageSquarePlus,
  Pen,
  Pencil,
  Pin,
  Search,
  Trash2,
  Wand2,
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
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useShallow } from 'zustand/shallow';

import { HeroComposer } from '../components/ui/HeroComposer';
import { QuickActionRow } from '../components/ui/QuickActionRow';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { SectionBlock } from '../components/ui/SectionBlock';
import SessionGroupHeader from '../components/ui/SessionGroupHeader';
import SwipeableRow from '../components/ui/SwipeableRow';
import { useToast } from '../components/ui/Toast';
import { userApi } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { getStreak, recordUsage } from '../lib/streak';
import { useSessionStore } from '../store/session';
import { useSessionGroupStore } from '../store/sessionGroup';
import { tokens } from '../theme/tokens';
import type { ChatSession } from '../types';

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
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

  const [heroText, setHeroText] = useState('');
  const [searchText, setSearchText] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [actionSession, setActionSession] = useState<ChatSession | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    if (!initialized) fetchSessions();
    fetchGroups();
    // Load user profile for avatar
    userApi
      .getUser()
      .then((u) => {
        if (u?.avatar) setUserAvatar(u.avatar);
        if (u?.fullName || u?.username) setUserName(u.fullName || u.username || null);
      })
      .catch(() => {
        /* ignore */
      });
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
    const newId = await createSession();
    haptics.success();
    toast.show('success', t.toastSessionCreated);
    navigation.navigate('ChatDetail', { sessionId: newId });
  };

  const handleHeroSubmit = async () => {
    if (!heroText.trim()) return;
    const newId = await createSession();
    navigation.navigate('ChatDetail', { sessionId: newId });
    setHeroText('');
  };

  const handleQuickAction = async (_key: string) => {
    const newId = await createSession();
    navigation.navigate('ChatDetail', { sessionId: newId });
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
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

  const handleRename = useCallback(
    (session: ChatSession) => {
      setActionSession(null);
      Alert.prompt(
        t.sessionRenameTitle,
        undefined,
        [
          { text: t.cancel, style: 'cancel' },
          {
            text: t.save,
            onPress: (newName?: string) => {
              if (newName?.trim()) {
                haptics.success();
                renameSession(session.id, newName.trim());
                toast.show('success', t.sessionRenamed);
              }
            },
          },
        ],
        'plain-text',
        session.title,
      );
    },
    [t, renameSession, toast],
  );

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
    { key: 'write', label: t.homeQuickWrite, icon: Pen },
    { key: 'code', label: t.homeQuickCode, icon: Code2 },
    { key: 'analyze', label: t.homeQuickAnalyze, icon: LineChart },
    { key: 'create', label: t.homeQuickCreate, icon: Wand2 },
  ];

  const renderSessionRow = (item: ChatSession) => (
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
        activeOpacity={0.6}
        className="flex-row items-center px-5 py-3 active:bg-foreground/5"
        onLongPress={() => handleLongPress(item)}
        onPress={() => navigation.navigate('ChatDetail', { sessionId: item.id })}
      >
        <View className="w-10 h-10 rounded-full items-center justify-center mr-3.5">
          {item.avatar ? (
            <Image className="w-10 h-10 rounded-full opacity-90" source={{ uri: item.avatar }} />
          ) : (
            <RNImage
              className="w-6 h-6 rounded-sm opacity-70"
              source={require('../../assets/icon.png')}
            />
          )}
        </View>
        <View className="flex-1 mr-3">
          <View className="flex-row items-center mb-0.5">
            {item.pinned && (
              <Pin
                color="#007aff"
                size={11}
                strokeWidth={tokens.icon.strokeWidth}
                style={{ marginRight: 4 }}
              />
            )}
            <Text
              className="text-foreground text-[15px] font-medium tracking-tight"
              numberOfLines={1}
            >
              {item.title}
            </Text>
          </View>
          <Text className="text-secondary/40 text-[12px] font-medium" numberOfLines={1}>
            {item.description}
          </Text>
        </View>
        <Text className="text-secondary/30 text-[10px] font-semibold uppercase tracking-widest">
          {formatTimeAgo(item.updatedAt)}
        </Text>
      </TouchableOpacity>
    </SwipeableRow>
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={greeting}
        leftElement={
          userAvatar ? (
            <RNImage className="w-8 h-8 rounded-full" source={{ uri: userAvatar }} />
          ) : (
            <View className="w-8 h-8 rounded-full bg-primary/10 items-center justify-center">
              <Text className="text-primary text-[12px] font-bold">
                {(userName || 'U').slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )
        }
        rightElement={
          <View className="flex-row items-center">
            <TouchableOpacity
              accessibilityLabel="Session groups"
              accessibilityRole="button"
              className="mr-2"
              onPress={() => navigation.navigate('SessionGroup')}
            >
              <FolderOpen color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />
            </TouchableOpacity>
            <MessageSquarePlus color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />
          </View>
        }
        subtitle={
          sessions.length > 0
            ? t.activeChats.replace('{count}', String(sessions.length))
            : undefined
        }
        onPressLeft={() => navigation.navigate('Me')}
        onPressRight={handleCreateChat}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            colors={['#007aff']}
            refreshing={refreshing}
            tintColor="#007aff"
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
              placeholder={t.homeHeroPlaceholder}
              value={heroText}
              onChangeText={setHeroText}
              onSubmit={handleHeroSubmit}
            />
          </View>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInDown.delay(75).duration(350)}>
          <View className="px-5 mt-2 mb-1">
            <View className="flex-row items-center bg-foreground/5 rounded-xl px-3.5 py-2.5">
              <Search color="#8c8c8c" size={16} strokeWidth={tokens.icon.strokeWidth} />
              <TextInput
                className="flex-1 ml-2.5 text-foreground text-[14.5px]"
                clearButtonMode="while-editing"
                placeholder={t.chatListSearch}
                placeholderTextColor="#8c8c8c"
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
                <Pin color="#007aff" size={18} strokeWidth={tokens.icon.strokeWidth} />
                <Text className="ml-3 text-base text-neutral-800">
                  {actionSession?.pinned ? t.actionUnpin : t.actionPin}
                </Text>
              </Pressable>

              {/* Rename */}
              <Pressable
                className="flex-row items-center py-3.5 px-3 rounded-xl active:bg-foreground/5"
                onPress={() => actionSession && handleRename(actionSession)}
              >
                <Pencil color="#007aff" size={18} strokeWidth={tokens.icon.strokeWidth} />
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
                <Trash2 color="#ff3b30" size={18} strokeWidth={tokens.icon.strokeWidth} />
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
    </View>
  );
}
