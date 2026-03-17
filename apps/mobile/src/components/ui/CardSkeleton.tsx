/**
 * CardSkeleton — Skeleton placeholder for Store card list.
 */
import React from 'react';
import { View } from 'react-native';

export default function CardSkeleton() {
  return (
    <View className="flex-1 px-5 pt-4 gap-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <View className="flex-row items-start rounded-2xl p-3.5 bg-foreground/[0.02]" key={i}>
          <View className="w-10 h-10 rounded-xl bg-foreground/8 mr-3" />
          <View className="flex-1">
            <View
              className="rounded-lg bg-foreground/8 mb-2"
              style={{ width: '60%', height: 14 }}
            />
            <View
              className="rounded-lg bg-foreground/6 mb-1.5"
              style={{ width: '90%', height: 12 }}
            />
            <View className="rounded-lg bg-foreground/6" style={{ width: '75%', height: 12 }} />
          </View>
        </View>
      ))}
    </View>
  );
}
