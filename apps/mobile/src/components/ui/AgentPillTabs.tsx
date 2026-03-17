/**
 * AgentPillTabs — Horizontal scrollable agent pills for filtering chats.
 * Replaces QuickActionRow. Shows "All" + agents with avatar.
 */
import { Image } from 'expo-image';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { semanticColors } from '../../constants/colors';
import type { AgentTemplate } from '../../types';

interface AgentPillTabsProps {
  agents: AgentTemplate[];
  selectedAgentId: string | null;
  onSelect: (agentId: string | null) => void;
  emptyLabel?: string;
}

function AgentAvatar({ agent, size = 24 }: { agent: AgentTemplate; size?: number }) {
  const avatar = agent.avatar || '🤖';

  if (avatar.length <= 4 && !avatar.startsWith('http')) {
    return (
      <View
        className="rounded-full bg-primary/10 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Text style={{ fontSize: size * 0.6 }}>{avatar}</Text>
      </View>
    );
  }

  if (avatar.startsWith('http')) {
    return (
      <View
        className="rounded-full bg-primary/10 overflow-hidden items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Image source={{ uri: avatar }} style={{ width: size, height: size }} />
      </View>
    );
  }

  return (
    <View
      className="rounded-full bg-primary/10 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Text style={{ fontSize: size * 0.6 }}>{avatar}</Text>
    </View>
  );
}

export function AgentPillTabs({
  agents,
  selectedAgentId,
  onSelect,
  emptyLabel = 'All',
}: AgentPillTabsProps) {
  const isAllSelected = selectedAgentId === null;

  return (
    <View className="px-5 mb-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          className={`flex-row items-center rounded-full px-4 py-2.5 ${
            isAllSelected ? 'bg-primary' : 'bg-foreground/[0.06]'
          }`}
          onPress={() => {
            haptics.light();
            onSelect(null);
          }}
        >
          <Text
            className={`text-[13px] font-semibold ${
              isAllSelected ? 'text-white' : 'text-foreground'
            }`}
          >
            {emptyLabel}
          </Text>
        </TouchableOpacity>

        {agents.map((agent) => {
          const isSelected = selectedAgentId === agent.id;
          return (
            <TouchableOpacity
              key={agent.id}
              activeOpacity={0.7}
              className={`flex-row items-center rounded-full px-3 py-2.5 gap-2 ${
                isSelected ? 'bg-primary' : 'bg-foreground/[0.06]'
              }`}
              onPress={() => {
                haptics.light();
                onSelect(agent.id);
              }}
            >
              <AgentAvatar agent={agent} size={22} />
              <Text
                className={`text-[13px] font-semibold max-w-[80px] ${
                  isSelected ? 'text-white' : 'text-foreground'
                }`}
                numberOfLines={1}
              >
                {agent.title || 'Agent'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
