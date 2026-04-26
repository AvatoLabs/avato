import React from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';

interface CreateResultCardProps {
  actions?: React.ReactNode;
  children: React.ReactNode;
  meta?: React.ReactNode;
  subtitle?: string;
  title: string;
}

export function CreateResultCard({
  actions,
  children,
  meta,
  subtitle,
  title,
}: CreateResultCardProps) {
  const colors = useThemeColors();

  return (
    <View
      className="mb-3 rounded-[24px] border p-3.5"
      style={{ backgroundColor: colors.card, borderColor: colors.borderSubtle }}
    >
      <Text
        numberOfLines={3}
        style={{ color: colors.foreground, fontSize: 14, fontWeight: '600', lineHeight: 20 }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          numberOfLines={1}
          style={{ color: colors.secondaryText, fontSize: 11, marginTop: 6 }}
        >
          {subtitle}
        </Text>
      ) : null}
      {meta ? <View className="mb-3 mt-3 flex-row flex-wrap items-center">{meta}</View> : null}
      {children}
      {actions ? <View className="mt-3">{actions}</View> : null}
    </View>
  );
}
