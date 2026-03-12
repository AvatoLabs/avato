import { BlurView } from 'expo-blur';
import { Brain, BrainCircuit, Cpu, Globe, Paperclip, Puzzle, Send } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Image as RNImage, TextInput, TouchableOpacity, View } from 'react-native';
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
  hasAttachment?: boolean;
  memoryEnabled?: boolean;
  modelProvider?: string;
  onAttach?: () => void;
  onChangeText?: (text: string) => void;
  onModelPress?: () => void;
  onPluginsPress?: () => void;
  onSubmit?: () => void;
  onToggleMemory?: () => void;
  onToggleSearch?: () => void;
  placeholder?: string;
  searchEnabled?: boolean;
  value?: string;
}

/**
 * HeroComposer — Large, prominent input area for the home screen.
 *
 * Toolbar (aligned with web ActionBar):
 *   [Model] [Search] [Memory] [Attach] [Skills] ... [Send]
 */
export function HeroComposer({
  modelProvider,
  placeholder = 'What do you want to do?',
  value = '',
  onChangeText,
  onSubmit,
  onModelPress,
  onToggleSearch,
  onToggleMemory,
  onAttach,
  onPluginsPress,
  memoryEnabled = true,
  searchEnabled = false,
  hasAttachment = false,
}: HeroComposerProps) {
  const colors = themeColors.light;
  const hasProvider = !!modelProvider?.trim();
  const [providerLogoError, setProviderLogoError] = useState(false);

  const sendScale = useSharedValue(1);
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));

  const handleSend = useCallback(() => {
    haptics.light();
    sendScale.value = withSequence(withSpring(0.8, { damping: 8 }), withSpring(1, { damping: 6 }));
    onSubmit?.();
  }, [onSubmit, sendScale]);

  const hasText = value.trim().length > 0;
  const canSend = hasText || hasAttachment;

  const MemoryIcon = memoryEnabled ? BrainCircuit : Brain;

  return (
    <View
      className="mx-4 mb-4 rounded-[26px]"
      style={{
        borderWidth: 1.5,
        borderColor: 'rgba(99,102,241,0.5)',
        backgroundColor: 'rgba(255,255,255,0.85)',
      }}
    >
      <BlurView className="rounded-[25px] overflow-hidden" intensity={80} tint="light">
        {/* Text input area */}
        <View className="px-3 pt-3">
          <TextInput
            multiline
            className="text-foreground text-[16px] leading-[22px] min-h-[60px] max-h-28 font-medium"
            placeholder={placeholder}
            placeholderTextColor={colors.secondary}
            style={{ textAlignVertical: 'top' }}
            value={value}
            onChangeText={onChangeText}
          />
        </View>

        {/* Toolbar row */}
        <View className="flex-row items-center px-2 pb-1.5 pt-1">
          {/* Model selector */}
          <TouchableOpacity
            accessibilityLabel="Select model"
            activeOpacity={0.7}
            className="w-8 h-8 items-center justify-center rounded-full"
            onPress={onModelPress}
          >
            {hasProvider && !providerLogoError ? (
              <RNImage
                style={{ width: 20, height: 20, borderRadius: 4 }}
                source={{
                  uri: `https://registry.npmmirror.com/@lobehub/icons-static-png/latest/files/light/${modelProvider}.png`,
                }}
                onError={() => setProviderLogoError(true)}
              />
            ) : (
              <Cpu color="#666" size={20} strokeWidth={tokens.icon.strokeWidth} />
            )}
          </TouchableOpacity>

          {/* Search / Web */}
          <TouchableOpacity
            accessibilityLabel="Toggle search"
            activeOpacity={0.7}
            className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
            onPress={onToggleSearch}
          >
            <Globe
              color={searchEnabled ? '#2563eb' : '#666'}
              size={20}
              strokeWidth={tokens.icon.strokeWidth}
            />
          </TouchableOpacity>

          {/* Memory toggle */}
          <TouchableOpacity
            accessibilityLabel="Toggle memory"
            activeOpacity={0.7}
            className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
            onPress={onToggleMemory}
          >
            <MemoryIcon
              color={memoryEnabled ? '#2563eb' : '#666'}
              size={20}
              strokeWidth={tokens.icon.strokeWidth}
            />
          </TouchableOpacity>

          {/* Attach */}
          <TouchableOpacity
            accessibilityLabel="Attach file"
            activeOpacity={0.7}
            className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
            onPress={onAttach}
          >
            <Paperclip color="#666" size={20} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>

          {/* Plugins */}
          <TouchableOpacity
            accessibilityLabel="Plugins"
            activeOpacity={0.7}
            className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
            onPress={onPluginsPress}
          >
            <Puzzle color="#666" size={20} strokeWidth={tokens.icon.strokeWidth} />
          </TouchableOpacity>

          {/* Spacer */}
          <View className="flex-1" />

          {/* Send button */}
          {canSend ? (
            <Animated.View style={sendAnimStyle}>
              <PressableScale
                className="w-9 h-9 bg-primary rounded-full items-center justify-center"
                onPress={handleSend}
              >
                <Send
                  color="#fff"
                  size={16}
                  strokeWidth={tokens.icon.strokeWidth}
                  style={{ marginLeft: 1 }}
                />
              </PressableScale>
            </Animated.View>
          ) : (
            <View className="w-9 h-9" />
          )}
        </View>
      </BlurView>
    </View>
  );
}
