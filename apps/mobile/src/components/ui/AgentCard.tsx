/**
 * AgentCard — Compact card for agent marketplace listings.
 */
import { Bot } from 'lucide-react-native';
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { tokens } from '../../theme/tokens';
import type { MarketAgent } from '../../types';
import PressableScale from './PressableScale';

interface AgentCardProps {
  agent: MarketAgent;
  onPress: () => void;
}

const AgentCard = memo<AgentCardProps>(({ agent, onPress }) => (
  <PressableScale
    className="rounded-2xl p-4 mr-3 border border-border"
    style={{ width: 200 }}
    onPress={onPress}
  >
    <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center mb-3">
      <Bot color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />
    </View>
    <Text
      className="text-foreground text-[14px] font-semibold tracking-tight mb-1"
      numberOfLines={1}
    >
      {agent.meta.title}
    </Text>
    <Text className="text-secondary/60 text-[12px] font-medium leading-[16px]" numberOfLines={2}>
      {agent.meta.description}
    </Text>
    {agent.meta.tags && agent.meta.tags.length > 0 && (
      <View className="flex-row flex-wrap mt-2 gap-1">
        {agent.meta.tags.slice(0, 2).map((tag) => (
          <View className="bg-primary/10 rounded-md px-2 py-0.5" key={tag}>
            <Text className="text-primary text-[10px] font-medium">{tag}</Text>
          </View>
        ))}
      </View>
    )}
    <Text className="text-secondary/30 text-[10px] font-semibold uppercase tracking-wider mt-2">
      by {agent.author}
    </Text>
  </PressableScale>
));

AgentCard.displayName = 'AgentCard';

export default AgentCard;
