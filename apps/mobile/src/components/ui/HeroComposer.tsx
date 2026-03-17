import { BlurView } from 'expo-blur';
import { Brain, BrainCircuit, Cpu, Globe, Paperclip, Puzzle, Send } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Image as RNImage, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { getProviderIconUrl } from '../../constants/cdn';
import { semanticColors } from '../../constants/colors';
import { haptics } from '../../lib/haptics';
import { useI18n } from '../../lib/i18n';
import { themeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface HeroComposerProps {
  attachmentCount?: number;
  hasAttachment?: boolean;
  memoryEnabled?: boolean;
  modelProvider?: string;
  modelProviderLogo?: string;
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
  attachmentCount,
  modelProvider,
  modelProviderLogo,
  placeholder: placeholderProp,
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
  const { t } = useI18n();
  const placeholder = placeholderProp ?? t.homeHeroPlaceholder;
  const [_isFocused, setIsFocused] = useState(false);
  const focusProgress = useSharedValue(0);
  const [providerLogoError, setProviderLogoError] = useState(false);
  const providerIconUrl =
    modelProviderLogo || (modelProvider ? getProviderIconUrl(modelProvider) : undefined);

  useEffect(() => {
    setProviderLogoError(false);
  }, [providerIconUrl]);

  const sendScale = useSharedValue(1);
  const sendAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
  }));
  const containerAnimStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      focusProgress.value,
      [0, 1],
      [themeColors.primaryBorder, themeColors.primaryFocused],
    ),
    borderWidth: 1.5 + focusProgress.value,
  }));

  const handleSend = useCallback(() => {
    haptics.light();
    sendScale.value = withSequence(withSpring(0.8, { damping: 8 }), withSpring(1, { damping: 6 }));
    onSubmit?.();
  }, [onSubmit, sendScale]);
  const handleBlur = useCallback(() => {
    setIsFocused(false);
    focusProgress.value = withTiming(0, { duration: 180 });
  }, [focusProgress]);
  const handleFocus = useCallback(() => {
    setIsFocused(true);
    focusProgress.value = withTiming(1, { duration: 180 });
  }, [focusProgress]);

  const hasText = value.trim().length > 0;
  const effectiveAttachmentCount =
    typeof attachmentCount === 'number' ? attachmentCount : hasAttachment ? 1 : 0;
  const hasAttachedFile = effectiveAttachmentCount > 0;
  const canSend = hasText || hasAttachedFile;
  const attachmentBadgeText =
    effectiveAttachmentCount > 9 ? '9+' : String(Math.max(effectiveAttachmentCount, 0));

  const MemoryIcon = memoryEnabled ? BrainCircuit : Brain;
  const useNativeBlur = Platform.OS !== 'android';

  return (
    <Animated.View
      className="mx-5 mb-4 rounded-2xl overflow-hidden"
      style={[{ backgroundColor: themeColors.overlay }, containerAnimStyle]}
    >
      {useNativeBlur ? (
        <BlurView className="rounded-2xl overflow-hidden" intensity={80} tint="light">
          {/* Text input area */}
          <View className="px-3 pt-3">
            <TextInput
              multiline
              className="text-foreground text-[16px] leading-[22px] min-h-[60px] max-h-28 font-medium"
              placeholder={placeholder}
              placeholderTextColor={themeColors.secondaryText}
              style={{ textAlignVertical: 'top' }}
              value={value}
              onBlur={handleBlur}
              onChangeText={onChangeText}
              onFocus={handleFocus}
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
              {providerIconUrl && !providerLogoError ? (
                <RNImage
                  style={{ width: 20, height: 20, borderRadius: 4 }}
                  source={{
                    uri: providerIconUrl,
                  }}
                  onError={() => setProviderLogoError(true)}
                />
              ) : (
                <Cpu color={semanticColors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
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
                color={searchEnabled ? themeColors.primary : semanticColors.muted}
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
                color={memoryEnabled ? themeColors.primary : semanticColors.muted}
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
              <View className="relative items-center justify-center">
                <Paperclip
                  color={hasAttachedFile ? themeColors.primary : semanticColors.muted}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                {hasAttachedFile && (
                  <View
                    className="absolute -right-2 -top-1 rounded-full bg-primary items-center justify-center"
                    style={{ minWidth: 14, height: 14, paddingHorizontal: 3 }}
                  >
                    <Text className="text-[9px] font-semibold text-white">
                      {attachmentBadgeText}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Plugins */}
            <TouchableOpacity
              accessibilityLabel="Plugins"
              activeOpacity={0.7}
              className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
              onPress={onPluginsPress}
            >
              <Puzzle
                color={semanticColors.muted}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
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
                    color={themeColors.iconOnPrimary}
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
      ) : (
        <View className="rounded-2xl px-0">
          {/* Text input area */}
          <View className="px-3 pt-3">
            <TextInput
              multiline
              className="text-foreground text-[16px] leading-[22px] min-h-[60px] max-h-28 font-medium"
              placeholder={placeholder}
              placeholderTextColor={themeColors.secondaryText}
              style={{ textAlignVertical: 'top' }}
              value={value}
              onBlur={handleBlur}
              onChangeText={onChangeText}
              onFocus={handleFocus}
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
              {providerIconUrl && !providerLogoError ? (
                <RNImage
                  style={{ width: 20, height: 20, borderRadius: 4 }}
                  source={{
                    uri: providerIconUrl,
                  }}
                  onError={() => setProviderLogoError(true)}
                />
              ) : (
                <Cpu color={semanticColors.muted} size={20} strokeWidth={tokens.icon.strokeWidth} />
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
                color={searchEnabled ? themeColors.primary : semanticColors.muted}
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
                color={memoryEnabled ? themeColors.primary : semanticColors.muted}
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
              <View className="relative items-center justify-center">
                <Paperclip
                  color={hasAttachedFile ? themeColors.primary : semanticColors.muted}
                  size={20}
                  strokeWidth={tokens.icon.strokeWidth}
                />
                {hasAttachedFile && (
                  <View
                    className="absolute -right-2 -top-1 rounded-full bg-primary items-center justify-center"
                    style={{ minWidth: 14, height: 14, paddingHorizontal: 3 }}
                  >
                    <Text className="text-[9px] font-semibold text-white">
                      {attachmentBadgeText}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>

            {/* Plugins */}
            <TouchableOpacity
              accessibilityLabel="Plugins"
              activeOpacity={0.7}
              className="w-8 h-8 items-center justify-center rounded-full ml-0.5"
              onPress={onPluginsPress}
            >
              <Puzzle
                color={semanticColors.muted}
                size={20}
                strokeWidth={tokens.icon.strokeWidth}
              />
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
                    color={themeColors.iconOnPrimary}
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
        </View>
      )}
    </Animated.View>
  );
}
