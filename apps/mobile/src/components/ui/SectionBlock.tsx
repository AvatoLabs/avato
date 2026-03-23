import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';

interface SectionBlockProps {
  action?: string;
  children: React.ReactNode;
  /** Tighter padding + uppercase title (e.g. chat directory drawer). */
  compact?: boolean;
  onAction?: () => void;
  title: string;
}

/**
 * SectionBlock — Consistent section wrapper with title and optional action link.
 * Provides visual grouping and rhythm to screen content.
 */
export function SectionBlock({ title, action, onAction, children, compact }: SectionBlockProps) {
  const colors = useThemeColors();
  const hPad = compact ? 'px-4' : 'px-5';
  const titleClass = compact
    ? 'text-[11px] font-semibold uppercase tracking-[1.2px]'
    : 'text-[13px] font-semibold tracking-tight';
  const headerMb = compact ? 'mb-2' : 'mb-3';
  const blockMb = compact ? 'mb-4' : 'mb-6';

  return (
    <View className={blockMb}>
      <View className={`flex-row items-center justify-between ${hPad} ${headerMb}`}>
        <Text className={titleClass} style={{ color: colors.secondaryText }}>
          {title}
        </Text>
        {action ? (
          <TouchableOpacity activeOpacity={0.6} onPress={onAction}>
            <Text className="text-[13px] font-medium" style={{ color: colors.primary }}>
              {action}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {children}
    </View>
  );
}
