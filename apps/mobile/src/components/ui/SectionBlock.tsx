import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

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
  return (
    <View className="mb-6">
      <View className="flex-row items-center justify-between px-5 mb-3">
        <Text className="text-foreground text-[15px] font-semibold tracking-tight">
          {title}
        </Text>
        {action && (
          <TouchableOpacity activeOpacity={0.6} onPress={onAction}>
            <Text className="text-primary text-[13px] font-medium">{action}</Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}
