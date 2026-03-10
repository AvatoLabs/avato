import React from 'react';
import { Text, TouchableOpacity } from 'react-native';

interface ModelChipProps {
  active?: boolean;
  name: string;
  onPress?: () => void;
  provider: string;
}

/**
 * ModelChip — Small pill showing model name + provider for horizontal scroll.
 */
export function ModelChip({ name, provider, active = false, onPress }: ModelChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className={`px-4 py-2 rounded-xl mr-2.5 border ${
        active
          ? 'bg-primary/10 dark:bg-primary/20 border-primary/20'
          : 'bg-foreground/5 dark:bg-white/5 border-black/5 dark:border-white/10'
      } active:opacity-80`}
      onPress={onPress}
    >
      <Text
        className={`text-[14px] font-semibold tracking-tight ${
          active ? 'text-primary' : 'text-foreground'
        }`}
      >
        {name}
      </Text>
      <Text className={`text-[12px] font-medium mt-0.5 ${
        active ? 'text-primary/70' : 'text-secondary'
      }`}>{provider}</Text>
    </TouchableOpacity>
  );
}
