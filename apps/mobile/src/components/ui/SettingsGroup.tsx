import React from 'react';
import { Text, View } from 'react-native';

interface SettingsGroupProps {
  children: React.ReactNode;
  title?: string;
}

/**
 * A minimalist container for settings rows that relies on alignment and spacing
 * rather than hard borders and boxed outlines.
 */
export function SettingsGroup({ title, children }: SettingsGroupProps) {
  return (
    <View className="mb-8">
      {title && (
        <Text className="px-5 mb-3 text-secondary/70 text-[13px] font-semibold uppercase tracking-[0.05em]">
          {title}
        </Text>
      )}
      <View className="px-2">
        {children}
      </View>
    </View>
  );
}
