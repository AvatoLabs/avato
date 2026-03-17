/**
 * MessageListSkeleton — Skeleton placeholder while messages are loading.
 */
import React from 'react';
import { View } from 'react-native';

export default function MessageListSkeleton() {
  return (
    <View className="flex-1 px-4 pt-4 gap-4">
      {/* User bubble skeleton */}
      <View className="flex-row justify-end">
        <View
          className="rounded-2xl bg-foreground/8"
          style={{ width: '70%', height: 48, maxWidth: 280 }}
        />
      </View>
      {/* Assistant bubble skeleton */}
      <View className="flex-row">
        <View
          className="rounded-2xl bg-foreground/8"
          style={{ width: '85%', height: 120, maxWidth: 320 }}
        />
      </View>
      <View className="flex-row">
        <View
          className="rounded-2xl bg-foreground/8"
          style={{ width: '60%', height: 80, maxWidth: 240 }}
        />
      </View>
    </View>
  );
}
