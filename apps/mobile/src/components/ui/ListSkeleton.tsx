/**
 * ListSkeleton — Skeleton placeholder for session/topic lists.
 */
import React from 'react';
import { View } from 'react-native';

export default function ListSkeleton() {
  return (
    <View className="flex-1 px-5 pt-4 gap-4">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View className="flex-row items-center" key={i}>
          <View className="w-12 h-12 rounded-full bg-foreground/8 mr-3" />
          <View className="flex-1">
            <View
              className="rounded-lg bg-foreground/8 mb-2"
              style={{ width: '70%', height: 16 }}
            />
            <View className="rounded-lg bg-foreground/6" style={{ width: '45%', height: 12 }} />
          </View>
        </View>
      ))}
    </View>
  );
}
