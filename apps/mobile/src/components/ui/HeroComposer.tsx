import { BlurView } from 'expo-blur';
import { Send } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { tokens } from '../../theme/tokens';

interface HeroComposerProps {
  modelLabel?: string;
  onChangeText?: (text: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  value?: string;
}

/**
 * HeroComposer — Large, prominent input area for the home screen.
 * Feels like an AI command surface, not a search bar.
 */
export function HeroComposer({
  placeholder = 'What do you want to do?',
  value = '',
  onChangeText,
  onSubmit,
  modelLabel = 'GPT-4o Mini',
}: HeroComposerProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className="mx-5 mb-5 rounded-xl overflow-hidden shadow-sm">
      <BlurView
        intensity={isDark ? 20 : 40}
        tint={isDark ? 'dark' : 'light'}
        className="border border-black/5 dark:border-white/10"
      >
        <View className="px-4 pt-4 pb-3">
          <TextInput
            multiline
            className="text-foreground text-[16px] leading-[24px] min-h-[64px] font-medium"
            placeholder={placeholder}
            placeholderTextColor={isDark ? '#a6a6a6' : '#8c8c8c'}
            style={{ textAlignVertical: 'top' }}
            value={value}
            onChangeText={onChangeText}
          />
        </View>
        <View className="flex-row items-center justify-between px-4 pb-3.5 pt-1">
          <View className="flex-row items-center bg-foreground/5 dark:bg-white/8 px-3 py-1.5 rounded-full">
            <View className="w-2 h-2 rounded-full bg-primary mr-2" />
            <Text className="text-secondary/80 text-[12px] font-medium">{modelLabel}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            className="w-10 h-10 bg-primary rounded-full items-center justify-center active:opacity-80"
            onPress={onSubmit}
          >
            <Send color="#fff" size={17} strokeWidth={tokens.icon.strokeWidth} style={{ marginLeft: 1 }} />
          </TouchableOpacity>
        </View>
      </BlurView>
    </View>
  );
}
