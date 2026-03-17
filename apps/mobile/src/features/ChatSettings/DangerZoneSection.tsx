/**
 * DangerZoneSection — Clear history and delete conversation.
 */
import { MessageSquare, Trash2 } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { semanticColors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';
import { themeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface DangerZoneSectionProps {
  delay?: number;
  onClearHistory: () => void;
  onDeleteChat: () => void;
}

export function DangerZoneSection({
  delay = 150,
  onClearHistory,
  onDeleteChat,
}: DangerZoneSectionProps) {
  const { t } = useI18n();

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View className="mx-5 mt-4">
        <Text className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
          {t.chatSettingsDangerZone}
        </Text>
        <View className="overflow-hidden rounded-2xl bg-foreground/[0.02]">
          <TouchableOpacity
            activeOpacity={0.6}
            className="flex-row items-center px-5 py-4 active:bg-foreground/[0.04]"
            onPress={onClearHistory}
          >
            <MessageSquare
              color={themeColors.iconWarning}
              size={17}
              strokeWidth={tokens.icon.strokeWidth}
              style={{ marginRight: 12 }}
            />
            <Text className="flex-1 text-[15px] font-medium text-foreground">
              {t.chatSettingsClearHistory}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.6}
            className="flex-row items-center px-5 py-4 active:bg-foreground/[0.04]"
            onPress={onDeleteChat}
          >
            <Trash2
              color={semanticColors.danger}
              size={17}
              strokeWidth={tokens.icon.strokeWidth}
              style={{ marginRight: 12 }}
            />
            <Text
              className="flex-1 text-[15px] font-medium"
              style={{ color: semanticColors.danger }}
            >
              {t.chatSettingsDeleteConversation}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}
