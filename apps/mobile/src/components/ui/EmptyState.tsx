/**
 * EmptyState — Unified empty state component with illustration and CTA.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';

interface EmptyStateProps {
  /** Optional CTA element (button, link) */
  action?: React.ReactNode;
  /** Additional padding */
  className?: string;
  /** Optional secondary description */
  description?: string;
  /** Optional emoji or icon (e.g. "📭", "🔍") */
  icon?: string;
  /** Primary title shown above description */
  title: string;
}

export default function EmptyState({
  title,
  description,
  icon = '📭',
  action,
  className = '',
}: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View
      accessibilityLabel={`${title}${description ? `. ${description}` : ''}`}
      className={`items-center justify-center px-8 py-12 ${className}`}
      style={{ minHeight: 160 }}
    >
      <Text className="text-4xl mb-4" style={{ fontSize: 32 }}>
        {icon}
      </Text>
      <Text
        className="text-center text-[16px] font-semibold mb-1.5"
        style={{ color: colors.foreground }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          className="text-center text-[14px] mb-4"
          style={{ color: colors.secondaryText + '99' }}
        >
          {description}
        </Text>
      ) : null}
      {action ?? null}
    </View>
  );
}
