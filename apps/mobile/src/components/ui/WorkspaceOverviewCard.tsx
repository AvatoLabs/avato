import { BlurView } from 'expo-blur';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Image as RNImage, Platform, Text, View } from 'react-native';

import { semanticColors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { useResolvedRemoteAsset } from '../../lib/remoteAsset';
import { themeColors } from '../../theme';
import { tokens } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface WorkspaceOverviewCardProps {
  defaultModel?: string;
  isConnected?: boolean;
  onPress?: () => void;
  onPressModel?: () => void;
  onPressProviders?: () => void;
  providerCount?: number;
  userAvatar?: string | null;
  userName?: string;
}

/**
 * WorkspaceOverviewCard — Identity + runtime status summary for the Workspace screen.
 *
 * Three independent tap zones:
 *  - Identity area (avatar + name) → onPress (ProfileEdit)
 *  - Model sub-card → onPressModel (ModelPicker)
 *  - Providers sub-card → onPressProviders (AIProviders)
 */
export function WorkspaceOverviewCard({
  userName = 'Avato User',
  defaultModel = 'GPT-4o Mini',
  isConnected = false,
  providerCount = 0,
  userAvatar,
  onPress,
  onPressModel,
  onPressProviders,
}: WorkspaceOverviewCardProps) {
  const colors = themeColors.light;
  const { t } = useI18n();
  const useNativeBlur = Platform.OS !== 'android';
  const resolvedAvatarUri = useResolvedRemoteAsset(userAvatar);

  return (
    <View
      className="mx-5 mb-6 rounded-2xl overflow-hidden bg-foreground/[0.04]"
      style={{ borderWidth: 1, borderColor: semanticColors.border }}
    >
      {useNativeBlur ? (
        <BlurView className="rounded-2xl overflow-hidden p-5" intensity={80} tint="light">
          {/* Identity — tap → ProfileEdit */}
          <PressableScale className="flex-row items-center mb-5" onPress={onPress}>
            <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3.5 overflow-hidden">
              {resolvedAvatarUri ? (
                <RNImage
                  source={{ uri: resolvedAvatarUri }}
                  style={{ width: 48, height: 48, borderRadius: 24 }}
                  onError={() => {}}
                />
              ) : (
                <Text className="text-primary text-[16px] font-bold">
                  {String(userName || 'U').slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-[18px] font-semibold tracking-tight">
                {userName || 'User'}
              </Text>
              <View className="flex-row items-center mt-1">
                <View
                  className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-primary' : 'bg-secondary/30'}`}
                />
                <Text className="text-secondary/80 text-[12px] font-medium">
                  {isConnected ? t.workspaceConnected : t.workspaceNotConnected}
                </Text>
              </View>
            </View>
            <ChevronRight color={semanticColors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
          </PressableScale>

          {/* Sub-cards — each independently tappable */}
          <View className="flex-row gap-3">
            <PressableScale
              className="flex-1 rounded-xl px-3.5 py-3 bg-foreground/[0.03]"
              onPress={onPressModel}
            >
              <Text className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: semanticColors.primary }}>
                {t.settingsDefaultModel}
              </Text>
              <Text
                className="text-foreground text-[14px] font-medium tracking-tight"
                numberOfLines={1}
              >
                {defaultModel}
              </Text>
            </PressableScale>
            <PressableScale
              className="flex-1 rounded-xl px-3.5 py-3 bg-foreground/[0.03]"
              onPress={onPressProviders}
            >
              <Text className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: semanticColors.primary }}>
                {t.workspaceProviders}
              </Text>
              <Text className="text-foreground text-[14px] font-medium tracking-tight">
                {(t.providerCountActive ?? '{count} active').replace('{count}', String(providerCount ?? 0))}
              </Text>
            </PressableScale>
          </View>
        </BlurView>
      ) : (
        <View className="rounded-2xl overflow-hidden p-5">
          {/* Identity — tap → ProfileEdit */}
          <PressableScale className="flex-row items-center mb-5" onPress={onPress}>
            <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3.5 overflow-hidden">
              {resolvedAvatarUri ? (
                <RNImage
                  source={{ uri: resolvedAvatarUri }}
                  style={{ width: 48, height: 48, borderRadius: 24 }}
                  onError={() => {}}
                />
              ) : (
                <Text className="text-primary text-[16px] font-bold">
                  {String(userName || 'U').slice(0, 2).toUpperCase()}
                </Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-[18px] font-semibold tracking-tight">
                {userName || 'User'}
              </Text>
              <View className="flex-row items-center mt-1">
                <View
                  className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-primary' : 'bg-secondary/30'}`}
                />
                <Text className="text-secondary/80 text-[12px] font-medium">
                  {isConnected ? t.workspaceConnected : t.workspaceNotConnected}
                </Text>
              </View>
            </View>
            <ChevronRight color={semanticColors.primary} size={20} strokeWidth={tokens.icon.strokeWidth} />
          </PressableScale>

          {/* Sub-cards — each independently tappable */}
          <View className="flex-row gap-3">
            <PressableScale
              className="flex-1 rounded-xl px-3.5 py-3 bg-foreground/[0.03]"
              onPress={onPressModel}
            >
              <Text className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: semanticColors.primary }}>
                {t.settingsDefaultModel}
              </Text>
              <Text
                className="text-foreground text-[14px] font-medium tracking-tight"
                numberOfLines={1}
              >
                {defaultModel}
              </Text>
            </PressableScale>
            <PressableScale
              className="flex-1 rounded-xl px-3.5 py-3 bg-foreground/[0.03]"
              onPress={onPressProviders}
            >
              <Text className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: semanticColors.primary }}>
                {t.workspaceProviders}
              </Text>
              <Text className="text-foreground text-[14px] font-medium tracking-tight">
                {(t.providerCountActive ?? '{count} active').replace('{count}', String(providerCount ?? 0))}
              </Text>
            </PressableScale>
          </View>
        </View>
      )}
    </View>
  );
}
