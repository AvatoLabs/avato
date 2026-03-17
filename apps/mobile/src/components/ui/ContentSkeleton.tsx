/**
 * ContentSkeleton — Skeleton placeholder for detail/content pages.
 */
import React from 'react';
import { View } from 'react-native';

export default function ContentSkeleton() {
  return (
    <View className="flex-1 px-5 pt-6">
      {/* Header area */}
      <View className="mb-6">
        <View className="rounded-lg bg-foreground/8 mb-3" style={{ width: '60%', height: 24 }} />
        <View className="rounded-lg bg-foreground/6" style={{ width: '85%', height: 14 }} />
      </View>
      {/* Content blocks */}
      {[1, 2, 3, 4, 5].map((i) => (
        <View className="mb-4" key={i}>
          <View className="rounded-lg bg-foreground/8 mb-2" style={{ width: '100%', height: 16 }} />
          <View className="rounded-lg bg-foreground/6 mb-1" style={{ width: '95%', height: 14 }} />
          <View className="rounded-lg bg-foreground/6" style={{ width: '80%', height: 14 }} />
        </View>
      ))}
    </View>
  );
}
