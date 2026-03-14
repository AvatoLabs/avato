import { BlurView } from 'expo-blur';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenHeaderProps {
  leftElement?: React.ReactNode;
  onPressLeft?: () => void;
  onPressRight?: () => void;
  rightElement?: React.ReactNode;
  subtitle?: string;
  title: string;
  titleCompact?: boolean;
}

export function ScreenHeader({
  title,
  subtitle,
  leftElement,
  rightElement,
  onPressLeft,
  onPressRight,
  titleCompact = false,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <BlurView intensity={85} style={{ paddingTop: insets.top }} tint="light">
      <View className="flex-row items-center justify-between px-5 py-3">
        {leftElement ? (
          <TouchableOpacity
            activeOpacity={0.6}
            className="h-10 items-start justify-center px-1 -ml-2"
            disabled={!onPressLeft}
            style={{ minWidth: 40 }}
            onPress={onPressLeft}
          >
            {leftElement}
          </TouchableOpacity>
        ) : (
          <View style={{ minWidth: 40 }} />
        )}

        <View className="flex-1 items-center justify-center">
          <Text
            className={`text-foreground ${titleCompact ? 'text-[15px] font-medium tracking-tight' : 'text-[22px] font-extrabold tracking-tighter'}`}
            numberOfLines={1}
          >
            {title}
          </Text>
          {subtitle && (
            <Text className="text-secondary/40 text-[11px] font-medium mt-0.5" numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {rightElement ? (
          <TouchableOpacity
            activeOpacity={0.6}
            className="h-10 items-end justify-center px-1 -mr-2"
            disabled={!onPressRight}
            style={{ minWidth: 40 }}
            onPress={onPressRight}
          >
            {rightElement}
          </TouchableOpacity>
        ) : (
          <View style={{ minWidth: 40 }} />
        )}
      </View>
    </BlurView>
  );
}
