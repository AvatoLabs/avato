import { BlurView } from 'expo-blur';
import { ChevronRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Image as RNImage, Text, View } from 'react-native';

import { useI18n } from '../../lib/i18n';
import { themeColors } from '../../theme';
import { tokens } from '../../theme/tokens';
import PressableScale from './PressableScale';

interface WorkspaceOverviewCardProps {
  defaultModel?: string;
  endpoint?: string;
  isConnected?: boolean;
  onPress?: () => void;
  providerCount?: number;
  userName?: string;
}

/**
 * WorkspaceOverviewCard — Identity + runtime status summary for the Workspace screen.
 */
export function WorkspaceOverviewCard({
  userName = 'MinkHub User',
  defaultModel = 'GPT-4o Mini',
  endpoint: _endpoint = 'Not configured',
  isConnected = false,
  providerCount = 0,
  onPress,
}: WorkspaceOverviewCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? themeColors.dark : themeColors.light;
  const { t } = useI18n();

  return (
    <PressableScale className="mx-5 mb-6 rounded-xl overflow-hidden shadow-sm" onPress={onPress}>
      <BlurView
        className="p-5 border border-black/5 dark:border-white/10"
        intensity={isDark ? 20 : 40}
        tint={isDark ? 'dark' : 'light'}
      >
        {/* Identity */}
        <View className="flex-row items-center mb-5">
          <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3.5 overflow-hidden">
            <RNImage className="w-8 h-8" source={require('../../../assets/icon.png')} />
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
        </View>

        {/* Stats row */}
        <View className="flex-row gap-3">
          <View className="flex-1 rounded-xl px-3.5 py-3 border border-black/5 dark:border-white/[0.06]">
            <Text className="text-secondary/60 text-[10px] font-semibold uppercase tracking-widest mb-1">
              {t.chatSettingsModel}
            </Text>
            <Text
              className="text-foreground text-[14px] font-medium tracking-tight"
              numberOfLines={1}
            >
              {defaultModel}
            </Text>
          </View>
          <View className="flex-1 rounded-xl px-3.5 py-3 border border-black/5 dark:border-white/[0.06]">
            <Text className="text-secondary/60 text-[10px] font-semibold uppercase tracking-widest mb-1">
              {t.workspaceProviders}
            </Text>
            <Text className="text-foreground text-[14px] font-medium tracking-tight">
              {t.providerCountActive.replace('{count}', String(providerCount))}
            </Text>
          </View>
        </View>
      </BlurView>
    </PressableScale>
  );
}
