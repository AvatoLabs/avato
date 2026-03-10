import { BlurView } from 'expo-blur';
import { ChevronRight } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Image as RNImage, Text, TouchableOpacity, View } from 'react-native';

import { tokens } from '../../theme/tokens';

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
  endpoint = 'Not configured',
  isConnected = false,
  providerCount = 0,
  onPress,
}: WorkspaceOverviewCardProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      className="mx-5 mb-6 rounded-[24px] overflow-hidden bg-foreground/5 dark:bg-white/5"
      onPress={onPress}
    >
      <BlurView className="p-5" intensity={isDark ? 20 : 40} tint={isDark ? 'dark' : 'light'}>
        {/* Identity */}
        <View className="flex-row items-center mb-5">
          <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center mr-3.5 overflow-hidden">
            <RNImage
              className="w-8 h-8"
              source={require('../../../assets/icon.png')}
            />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-[18px] font-semibold tracking-tight">{userName}</Text>
            <View className="flex-row items-center mt-1">
              <View className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-[#4caf50]' : 'bg-secondary/30'}`} />
              <Text className="text-secondary/60 text-[12.5px] font-medium">
                {isConnected ? 'Connected' : 'Not connected'}
              </Text>
            </View>
          </View>
          <ChevronRight color="#c0c0c0" size={20} strokeWidth={tokens.icon.strokeWidth} />
        </View>

        {/* Stats row */}
        <View className="flex-row gap-3">
          <View className="flex-1 bg-foreground/5 dark:bg-white/5 rounded-2xl px-3.5 py-3">
            <Text className="text-secondary/50 text-[10.5px] font-medium uppercase tracking-wider mb-1">Model</Text>
            <Text className="text-foreground text-[13.5px] font-medium tracking-tight" numberOfLines={1}>{defaultModel}</Text>
          </View>
          <View className="flex-1 bg-foreground/5 dark:bg-white/5 rounded-2xl px-3.5 py-3">
            <Text className="text-secondary/50 text-[10.5px] font-medium uppercase tracking-wider mb-1">Providers</Text>
            <Text className="text-foreground text-[13.5px] font-medium tracking-tight">{providerCount} active</Text>
          </View>
        </View>
      </BlurView>
    </TouchableOpacity>
  );
}
