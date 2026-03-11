/**
 * SessionGroupHeader — Collapsible section header for session groups.
 */
import { ChevronDown, ChevronRight, Folder } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { tokens } from '../../theme/tokens';

interface SessionGroupHeaderProps {
  color?: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  title: string;
}

const SessionGroupHeader = memo<SessionGroupHeaderProps>(
  ({ title, count, expanded, onToggle, color = '#007aff' }) => {
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const Chevron = expanded ? ChevronDown : ChevronRight;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        className="flex-row items-center px-5 py-2.5 mt-2"
        onPress={onToggle}
      >
        <View className="w-7 h-7 rounded-lg bg-foreground/5 dark:bg-white/5 items-center justify-center mr-3">
          <Folder color={color} size={14} strokeWidth={tokens.icon.strokeWidth} />
        </View>
        <Text className="flex-1 text-[13px] font-semibold text-secondary/60 uppercase tracking-wider">
          {title}
        </Text>
        <Text className="text-secondary/40 text-[11px] font-medium mr-2">{count}</Text>
        <Chevron color={isDark ? '#aaa' : '#666'} size={16} strokeWidth={tokens.icon.strokeWidth} />
      </TouchableOpacity>
    );
  },
);

SessionGroupHeader.displayName = 'SessionGroupHeader';

export default SessionGroupHeader;
