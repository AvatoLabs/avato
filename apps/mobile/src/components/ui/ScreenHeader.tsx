import { BlurView } from 'expo-blur';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenHeaderProps {
  leftElement?: React.ReactNode;
  onPressLeft?: () => void;
  onPressRight?: () => void;
  rightElement?: React.ReactNode;
  title: string;
  titleCompact?: boolean;
}

export function ScreenHeader({
  title,
  leftElement,
  rightElement,
  onPressLeft,
  onPressRight,
  titleCompact = false,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <BlurView
      intensity={85}
      style={{ paddingTop: insets.top }}
      tint={isDark ? 'dark' : 'light'}

    >
      <View className="flex-row items-center justify-between px-5 py-3">
        {leftElement ? (
          <TouchableOpacity
            activeOpacity={0.6}
             className="w-10 h-10 items-start justify-center -ml-2"
            disabled={!onPressLeft}
            onPress={onPressLeft}
          >
            {leftElement}
          </TouchableOpacity>
        ) : (
          <View className="w-8" />
        )}

        <View className="flex-1 items-center justify-center">
             <Text
                className={`text-foreground font-medium tracking-wide ${titleCompact ? 'text-[15px]' : 'text-lg font-semibold'}`}
                numberOfLines={1}
            >
                {title}
            </Text>
        </View>

        {rightElement ? (
           <TouchableOpacity
            activeOpacity={0.6}
            className="w-10 h-10 items-end justify-center -mr-2"
            disabled={!onPressRight}
            onPress={onPressRight}
          >
            {rightElement}
          </TouchableOpacity>
        ) : (
          <View className="w-8" />
        )}
      </View>
    </BlurView>
  );
}
