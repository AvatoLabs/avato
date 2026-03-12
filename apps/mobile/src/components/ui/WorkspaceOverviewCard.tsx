import { BlurView } from 'expo-blur';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Image as RNImage, Text, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
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
  userName = 'MinkHub User',
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

  return (
    <View
      className="mx-5 mb-6 rounded-[26px]"
      style={{
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderColor: 'rgba(99,102,241,0.5)',
        borderWidth: 1.5,
      }}
    >
      <BlurView className="rounded-[25px] overflow-hidden p-5" intensity={80} tint="light">
        {/* Identity — tap → ProfileEdit */}
        <PressableScale className="flex-row items-center mb-5" onPress={onPress}>
          <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3.5 overflow-hidden">
            {userAvatar ? (
              <RNImage
                source={{ uri: userAvatar }}
                style={{ width: 48, height: 48, borderRadius: 24 }}
              />
            ) : (
              <Text className="text-primary text-[16px] font-bold">
                {(userName || 'U').slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-[18px] font-semibold tracking-tight">
              {userName}
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
          <ChevronRight color={colors.secondary} size={20} strokeWidth={tokens.icon.strokeWidth} />
        </PressableScale>

        {/* Sub-cards — each independently tappable */}
        <View className="flex-row gap-3">
          <PressableScale
            className="flex-1 rounded-xl px-3.5 py-3 border border-black/5"
            onPress={onPressModel}
          >
            <Text className="text-secondary/60 text-[10px] font-semibold uppercase tracking-widest mb-1">
              {t.chatSettingsModel}
            </Text>
            <Text
              className="text-foreground text-[14px] font-medium tracking-tight"
              numberOfLines={1}
            >
              {defaultModel}
            </Text>
          </PressableScale>
          <PressableScale
            className="flex-1 rounded-xl px-3.5 py-3 border border-black/5"
            onPress={onPressProviders}
          >
            <Text className="text-secondary/60 text-[10px] font-semibold uppercase tracking-widest mb-1">
              {t.workspaceProviders}
            </Text>
            <Text className="text-foreground text-[14px] font-medium tracking-tight">
              {t.providerCountActive.replace('{count}', String(providerCount))}
            </Text>
          </PressableScale>
        </View>
      </BlurView>
    </View>
  );
}
