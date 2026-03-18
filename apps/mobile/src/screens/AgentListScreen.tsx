/**
 * AgentListScreen — Manage user agents (assistants).
 * Lists agents from agentApi.queryAgents, tap to open chat or create new.
 */
import { ArrowLeft, Bot, MessageCircle, Plus, Settings2, Trash2 } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image as RNImage,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import EmptyState from '../components/ui/EmptyState';
import PressableScale from '../components/ui/PressableScale';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useToast } from '../components/ui/Toast';
import { agentApi, type AgentQueryItem } from '../lib/api';
import { haptics } from '../lib/haptics';
import { useI18n } from '../lib/i18n';
import { useSessionStore } from '../store/session';
import { useThemeColors } from '../theme/colors';
import { tokens } from '../theme/tokens';

function AgentAvatar({ agent }: { agent: AgentQueryItem }) {
  const colors = useThemeColors();
  const avatar = agent.avatar?.trim();
  if (avatar && avatar.length <= 4 && !avatar.startsWith('http')) {
    return (
      <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primarySubtle }}>
        <Text className="text-[20px]">{avatar}</Text>
      </View>
    );
  }
  if (avatar && avatar.startsWith('http')) {
    return <RNImage source={{ uri: avatar }} style={{ height: 48, width: 48, borderRadius: 12 }} />;
  }
  return (
    <View className="h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: colors.primarySubtle }}>
      <Bot color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
    </View>
  );
}

export default function AgentListScreen({ navigation }: any) {
  const { t } = useI18n();
  const toast = useToast();
  const colors = useThemeColors();
  const sessions = useSessionStore((s) => s.sessions);
  const fetchSessions = useSessionStore((s) => s.fetchSessions);

  const [agents, setAgents] = useState<AgentQueryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  const loadAgents = useCallback(async () => {
    try {
      const result = await agentApi.queryAgents({ limit: 200 });
      setAgents(Array.isArray(result) ? result : []);
    } catch {
      setAgents([]);
      toast.show('error', t.errorNetwork);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t.errorNetwork, toast]);

  useEffect(() => {
    void loadAgents();
    void fetchSessions();
  }, [loadAgents, fetchSessions]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    haptics.light();
    await Promise.all([loadAgents(), fetchSessions()]);
  }, [loadAgents, fetchSessions]);

  const getSessionForAgent = useCallback(
    (agentId: string) => {
      return sessions.find((s) => s.config?.id === agentId || s.agentId === agentId);
    },
    [sessions],
  );

  const handleAgentPress = useCallback(
    async (agent: AgentQueryItem) => {
      haptics.light();
      const session = getSessionForAgent(agent.id);
      if (session) {
        navigation?.navigate?.('ChatDetail', { sessionId: session.id });
        return;
      }
      // No session: create agent (which creates session)
      try {
        setCreating(true);
        const result = await agentApi.create({
          title: agent.title || t.chatListNewConversation,
          description: agent.description,
          avatar: agent.avatar,
        });
        if (result?.sessionId) {
          await fetchSessions();
          navigation?.navigate?.('ChatDetail', { sessionId: result.sessionId });
        }
      } catch {
        toast.show('error', t.errorNetwork);
      } finally {
        setCreating(false);
      }
    },
    [
      getSessionForAgent,
      navigation,
      fetchSessions,
      t.chatListNewConversation,
      toast,
      t.errorNetwork,
    ],
  );

  const handleConfigureAgent = useCallback(
    (agent: AgentQueryItem) => {
      haptics.light();
      const session = getSessionForAgent(agent.id);
      if (session) {
        navigation?.navigate?.('AgentConfig', { sessionId: session.id });
      } else {
        navigation?.navigate?.('AgentConfig', { agentId: agent.id });
      }
    },
    [getSessionForAgent, navigation],
  );

  const handleDeleteAgent = useCallback(
    (agent: AgentQueryItem) => {
      if (agents.length <= 1) {
        toast.show('info', t.agentDeleteDefaultForbidden);
        return;
      }
      haptics.light();
      Alert.alert(t.agentDeleteConfirm, t.agentDeleteDesc, [
        { style: 'cancel', text: t.cancel },
        {
          style: 'destructive',
          text: t.delete,
          onPress: async () => {
            try {
              await agentApi.removeAgent(agent.id);
              haptics.success();
              toast.show('success', t.toastSessionDeleted);
              await loadAgents();
              await fetchSessions();
            } catch {
              toast.show('error', t.errorDeleteFailed);
            }
          },
        },
      ]);
    },
    [
      agents.length,
      fetchSessions,
      loadAgents,
      t.agentDeleteConfirm,
      t.agentDeleteDefaultForbidden,
      t.agentDeleteDesc,
      t.cancel,
      t.delete,
      t.errorDeleteFailed,
      toast,
      t.toastSessionDeleted,
    ],
  );

  const handleCreateAgent = useCallback(async () => {
    haptics.light();
    try {
      setCreating(true);
      const result = await agentApi.create();
      if (result?.sessionId) {
        await fetchSessions();
        navigation?.navigate?.('ChatDetail', { sessionId: result.sessionId });
      }
    } catch {
      toast.show('error', t.errorNetwork);
    } finally {
      setCreating(false);
    }
  }, [navigation, fetchSessions, toast, t.errorNetwork]);

  const renderItem = useCallback(
    ({ item }: { item: AgentQueryItem }) => (
      <PressableScale
        className="mx-5 mb-3 flex-row items-center rounded-xl bg-foreground/[0.03] px-4 py-3.5"
        onPress={() => handleAgentPress(item)}
      >
        <AgentAvatar agent={item} />
        <View className="ml-4 flex-1">
          <Text className="text-[15px] font-medium text-foreground" numberOfLines={1}>
            {item.title || t.agentConfigNamePlaceholder}
          </Text>
          {item.description ? (
            <Text className="mt-0.5 text-[12px] text-secondary/70" numberOfLines={2}>
              {item.description}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          accessible
          accessibilityLabel={t.agentConfigTitle}
          className="mr-3 p-2 -m-2"
          hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
          onPress={() => handleConfigureAgent(item)}
        >
          <Settings2 color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
        </TouchableOpacity>
        {agents.length > 1 ? (
          <TouchableOpacity
            accessible
            accessibilityLabel={t.delete}
            className="p-2 -m-2"
            hitSlop={{ bottom: 8, left: 8, right: 8, top: 8 }}
            onPress={() => handleDeleteAgent(item)}
          >
            <Trash2 color={colors.danger} size={18} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>
        ) : (
          <MessageCircle color={colors.primary} size={18} strokeWidth={tokens.icon.strokeWidth} />
        )}
      </PressableScale>
    ),
    [
      agents.length,
      colors.danger,
      colors.primary,
      handleAgentPress,
      handleConfigureAgent,
      handleDeleteAgent,
      t.agentConfigNamePlaceholder,
      t.agentConfigTitle,
      t.delete,
    ],
  );

  if (loading) {
    return (
      <View className="flex-1 bg-background">
        <ScreenHeader
          title={t.meAgents}
          leftElement={
            <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
          }
          onPressLeft={() => {
            haptics.light();
            navigation?.goBack?.();
          }}
        />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.meAgents}
        leftElement={
          <ArrowLeft color={colors.primary} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => {
          haptics.light();
          navigation?.goBack?.();
        }}
      />

      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState
            description={t.agentsEmptyDesc}
            iconVariant="agent"
            title={t.agentsEmpty}
            action={
              <PressableScale
                className="rounded-2xl px-5 py-3"
                style={{ backgroundColor: colors.primary }}
                disabled={creating}
                onPress={handleCreateAgent}
              >
                <View className="flex-row items-center gap-2">
                  <Plus color={colors.iconOnPrimary} size={18} strokeWidth={2} />
                  <Text className="text-[14px] font-semibold text-white">
                    {t.chatListCreateAgent}
                  </Text>
                </View>
              </PressableScale>
            }
          />
        }
        contentContainerStyle={
          agents.length === 0
            ? { flexGrow: 1, justifyContent: 'center', paddingBottom: 100, paddingTop: 8 }
            : { paddingBottom: 100, paddingTop: 8 }
        }
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={onRefresh}
          />
        }
      />

      {agents.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full shadow-lg"
          style={{ backgroundColor: colors.primary, elevation: 4, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25 }}
          disabled={creating}
          onPress={handleCreateAgent}
        >
          <Plus color={colors.iconOnPrimary} size={24} strokeWidth={2} />
        </TouchableOpacity>
      )}
    </View>
  );
}
