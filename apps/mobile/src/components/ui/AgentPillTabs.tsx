/**
 * AgentPillTabs — Horizontal scrollable agent pills for filtering chats.
 * Replaces QuickActionRow. Shows "All" + agents with avatar.
 */
import { Image } from 'expo-image';
import React, { useCallback, useMemo } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme/colors';
import type { AgentTemplate } from '../../types';

interface AgentPillTabsProps {
  agents: AgentTemplate[];
  emptyLabel?: string;
  onSelect: (agentId: string | null) => void;
  selectedAgentId: string | null;
}

interface AgentPillTabItem {
  agent?: AgentTemplate;
  id: string;
}

function AgentAvatar({ agent, size = 24 }: { agent: AgentTemplate; size?: number }) {
  const colors = useThemeColors();
  const avatar = agent.avatar || '🤖';

  if (avatar.length <= 4 && !avatar.startsWith('http')) {
    return (
      <View
        className="rounded-full items-center justify-center"
        style={{ width: size, height: size, backgroundColor: colors.primarySubtle }}
      >
        <Text style={{ fontSize: size * 0.6, color: colors.primary }}>{avatar}</Text>
      </View>
    );
  }

  if (avatar.startsWith('http')) {
    return (
      <View
        className="rounded-full overflow-hidden items-center justify-center"
        style={{ width: size, height: size, backgroundColor: colors.primarySubtle }}
      >
        <Image source={{ uri: avatar }} style={{ width: size, height: size }} />
      </View>
    );
  }

  return (
    <View
      className="rounded-full items-center justify-center"
      style={{ width: size, height: size, backgroundColor: colors.primarySubtle }}
    >
      <Text style={{ fontSize: size * 0.6, color: colors.primary }}>{avatar}</Text>
    </View>
  );
}

export function AgentPillTabs({
  agents,
  selectedAgentId,
  onSelect,
  emptyLabel = 'All',
}: AgentPillTabsProps) {
  const colors = useThemeColors();
  const isAllSelected = selectedAgentId === null;
  const items = useMemo<AgentPillTabItem[]>(
    () => [{ id: '__all__' }, ...agents.map((agent) => ({ agent, id: agent.id }))],
    [agents],
  );
  const renderItem = useCallback(
    ({ item }: { item: AgentPillTabItem }) => {
      if (!item.agent) {
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            className="flex-row items-center rounded-full px-4 py-2.5"
            style={{
              backgroundColor: isAllSelected ? colors.primary : colors.fillTertiary,
            }}
            onPress={() => {
              haptics.light();
              onSelect(null);
            }}
          >
            <Text
              className="text-[13px] font-semibold"
              style={{ color: isAllSelected ? colors.iconOnPrimary : colors.foreground }}
            >
              {emptyLabel}
            </Text>
          </TouchableOpacity>
        );
      }

      const agent = item.agent;
      const isSelected = selectedAgentId === agent.id;

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          className="flex-row items-center rounded-full px-3 py-2.5 gap-2"
          style={{
            backgroundColor: isSelected ? colors.primary : colors.fillTertiary,
          }}
          onPress={() => {
            haptics.light();
            onSelect(agent.id);
          }}
        >
          <AgentAvatar agent={agent} size={22} />
          <Text
            className="text-[13px] font-semibold max-w-[80px]"
            numberOfLines={1}
            style={{ color: isSelected ? colors.iconOnPrimary : colors.foreground }}
          >
            {agent.title || 'Agent'}
          </Text>
        </TouchableOpacity>
      );
    },
    [
      colors.fillTertiary,
      colors.foreground,
      colors.iconOnPrimary,
      colors.primary,
      emptyLabel,
      isAllSelected,
      onSelect,
      selectedAgentId,
    ],
  );

  return (
    <View className="px-5 mb-4">
      <FlatList
        horizontal
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        data={items}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}
