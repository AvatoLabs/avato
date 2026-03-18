import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';

interface SectionBlockProps {
  action?: string;
  children: React.ReactNode;
  onAction?: () => void;
  title: string;
}

/**
 * SectionBlock — Consistent section wrapper with title and optional action link.
 * Provides visual grouping and rhythm to screen content.
 */
export function SectionBlock({ title, action, onAction, children }: SectionBlockProps) {
  const colors = useThemeColors();
  return (
    <View className="mb-6">
      <View className="flex-row items-center justify-between px-5 mb-3">
        <Text
          className="text-[12px] font-medium uppercase tracking-wider"
          style={{ color: colors.secondaryText }}
        >
          {title}
        </Text>
        {action && (
          <TouchableOpacity activeOpacity={0.6} onPress={onAction}>
            <Text className="text-[13px] font-medium" style={{ color: colors.primary }}>{action}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}
