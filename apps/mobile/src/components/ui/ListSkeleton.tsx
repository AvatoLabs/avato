/**
 * ListSkeleton — Skeleton placeholder for session/topic lists.
 */
import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { useThemeColors } from '../../theme/colors';
import { enteringSkeleton } from '../../theme/motion';

export default function ListSkeleton() {
  const colors = useThemeColors();
  const titleWidths = ['72%', '58%', '68%', '64%', '76%', '61%'];
  const subtitleWidths = ['44%', '38%', '49%', '42%', '46%', '40%'];

  return (
    <Animated.View className="flex-1 px-5 pt-4 gap-4" entering={enteringSkeleton()}>
      {titleWidths.map((titleWidth, index) => (
        <View className="flex-row items-center" key={index}>
          <View
            className="mr-3 h-12 w-12 rounded-full"
            style={{ backgroundColor: colors.fillTertiary }}
          />
          <View className="flex-1">
            <View
              className="mb-2 rounded-lg"
              style={{ backgroundColor: colors.fillTertiary, height: 16, width: titleWidth }}
            />
            <View
              className="rounded-lg"
              style={{
                backgroundColor: colors.fillQuaternary,
                height: 12,
                width: subtitleWidths[index],
              }}
            />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
