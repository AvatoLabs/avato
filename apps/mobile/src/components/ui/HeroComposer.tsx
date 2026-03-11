import { BlurView } from 'expo-blur';
import { Send } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React, { useCallback } from 'react';
import { Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { haptics } from '../../lib/haptics';
import { themeColors } from '../../theme';
import { tokens } from '../../theme/tokens';
import PressableScale from './PressableScale';

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
  const colors = isDark ? themeColors.dark : themeColors.light;

  const sendScale = useSharedValue(1);
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const handlePress = useCallback(() => {
    haptics.light();
    sendScale.value = withSequence(withSpring(0.8, { damping: 8 }), withSpring(1, { damping: 6 }));
    onSubmit?.();
  }, [onSubmit, sendScale]);

  return (
    <View className="mx-5 mb-5 rounded-xl overflow-hidden shadow-sm">
      <BlurView
        className="border border-black/5 dark:border-white/10"
        intensity={isDark ? 20 : 40}
        tint={isDark ? 'dark' : 'light'}
      >
        <View className="px-4 pt-4 pb-3">
          <TextInput
            multiline
            className="text-foreground text-[16px] leading-[24px] min-h-[64px] font-medium"
            placeholder={placeholder}
            placeholderTextColor={colors.secondary}
            style={{ textAlignVertical: 'top' }}
            value={value}
            onChangeText={onChangeText}
          />
        </View>
        <View className="flex-row items-center justify-between px-4 pb-3.5 pt-1">
          <View className="flex-row items-center px-3 py-1.5 rounded-full border border-black/5 dark:border-white/[0.06]">
            <View className="w-2 h-2 rounded-full bg-primary mr-2" />
            <Text className="text-secondary/60 text-[11px] font-semibold tracking-tight">
              {modelLabel}
            </Text>
          </View>
          <Animated.View style={sendAnimStyle}>
            <PressableScale
              className="w-10 h-10 bg-primary rounded-full items-center justify-center"
              onPress={handlePress}
            >
              <Send
                color="#fff"
                size={17}
                strokeWidth={tokens.icon.strokeWidth}
                style={{ marginLeft: 1 }}
              />
            </PressableScale>
          </Animated.View>
        </View>
      </BlurView>
    </View>
  );
}
