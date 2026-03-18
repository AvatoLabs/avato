/**
 * TagSection — Tag selector for ChatSettings (single-agent only).
 */
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { semanticColors } from '../../constants/colors';
import { resolveTagColor, withAlpha } from '../../constants/tags';
import { useI18n } from '../../lib/i18n';
import { tokens } from '../../theme/tokens';
import type { SessionTag } from '../../types';

interface TagSectionProps {
  currentTag?: SessionTag | null;
  delay?: number;
  onPress: () => void;
}

export function TagSection({ currentTag, delay = 90, onPress }: TagSectionProps) {
  const { t } = useI18n();

  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(300)}>
      <View className="mx-5 mb-5">
        <Text className="mb-2 px-2 text-[12px] font-medium uppercase tracking-wider text-secondary/60">
          {t.chatSettingsTag}
        </Text>
        <TouchableOpacity
          activeOpacity={0.8}
          className="flex-row items-center rounded-2xl bg-foreground/[0.02] px-4 py-3"
          onPress={onPress}
        >
          <View
            className="mr-3 h-2.5 w-2.5 rounded-full"
            style={{
              backgroundColor: currentTag
                ? resolveTagColor(currentTag.color)
                : semanticColors.secondaryText,
            }}
          />
          <View
            className="mr-3 rounded-full px-3 py-1"
            style={{
              backgroundColor: currentTag
                ? withAlpha(currentTag.color, '18')
                : semanticColors.fillTertiary,
            }}
          >
            <Text
              className="text-[13px] font-semibold"
              style={{
                color: currentTag
                  ? resolveTagColor(currentTag.color)
                  : semanticColors.secondaryText,
              }}
            >
              {currentTag?.name || t.tagNone}
            </Text>
          </View>
          <View className="flex-1" />
          <ChevronRight
            color={semanticColors.secondaryText}
            size={16}
            strokeWidth={tokens.icon.strokeWidth}
          />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
