/**
 * FileGridSkeleton — Skeleton placeholder for resource/file list.
 */
import React from 'react';
import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import { enteringSkeleton } from '../../theme/motion';

export default function FileGridSkeleton() {
  return (
    <Animated.View
      entering={enteringSkeleton()}
      className="flex-1 px-4 pt-4"
    >
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View className="flex-row items-center py-4" key={i}>
          <View className="w-10 h-10 rounded-lg bg-foreground/8 mr-3" />
          <View className="flex-1">
            <View
              className="rounded-lg bg-foreground/8 mb-2"
              style={{ width: '65%', height: 14 }}
            />
            <View className="rounded-lg bg-foreground/6" style={{ width: '40%', height: 11 }} />
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
