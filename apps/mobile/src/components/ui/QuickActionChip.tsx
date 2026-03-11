import React from 'react';
import { Text, TouchableOpacity, type TouchableOpacityProps, View } from 'react-native';

interface QuickActionChipProps extends TouchableOpacityProps {
  active?: boolean;
  icon?: React.ReactNode;
  label: string;
}

/**
 * A pill-shaped button for quick actions, tags, or tabs, using subtle layering.
 */
export function QuickActionChip({
  label,
  icon,
  active = false,
  className = '',
  ...props
}: QuickActionChipProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className={`flex-row items-center px-4 py-2 rounded-full border ${
        active
          ? 'bg-primary/10 border-primary/20'
          : 'bg-foreground/5 border-transparent active:bg-foreground/10'
      } ${className}`}
      {...props}
    >
      {icon && <View className="mr-1.5">{icon}</View>}
      <Text className={`text-[14px] font-medium ${active ? 'text-primary' : 'text-foreground'}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
