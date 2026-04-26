/**
 * DangerZoneSection — Clear history and delete session (with all its topics).
 */
import { MessageSquare, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface DangerZoneSectionProps {
  contentWidth?: number;
  delay?: number;
  onClearHistory: () => void;
  onDeleteChat: () => void;
}

export function DangerZoneSection({
  contentWidth,
  delay = 150,
  onClearHistory,
  onDeleteChat,
}: DangerZoneSectionProps) {
  const { t } = useI18n();
  const colors = useThemeColors();

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View className="mt-4 self-center" style={contentWidth ? { width: contentWidth } : undefined}>
        <Text className="mb-2 px-2 text-[12px] font-medium uppercase tracking-wider text-secondary/60">
          {t.chatSettingsDangerZone}
        </Text>
        <View className="overflow-hidden rounded-xl bg-foreground/[0.02]">
          <TouchableOpacity
            activeOpacity={0.6}
            className="flex-row items-center px-5 py-4 active:bg-foreground/[0.04]"
            onPress={onClearHistory}
          >
            <View className="mr-3">
              <MessageSquare
                color={colors.iconWarning}
                size={17}
                strokeWidth={tokens.icon.strokeWidth}
              />
            </View>
            <Text className="flex-1 text-[15px] font-medium text-foreground">
              {t.chatSettingsClearHistory}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.6}
            className="flex-row items-center px-5 py-4 active:bg-foreground/[0.04]"
            onPress={onDeleteChat}
          >
            <View className="mr-3">
              <Trash2 color={colors.danger} size={17} strokeWidth={tokens.icon.strokeWidth} />
            </View>
            <Text className="flex-1 text-[15px] font-medium" style={{ color: colors.danger }}>
              {t.chatSettingsDeleteConversation}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
