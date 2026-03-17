/**
 * EmptyState — Unified empty state component with illustration and CTA.
 */
import React from 'react';
import { Text, View } from 'react-native';

import { semanticColors } from '../../constants/colors';

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
  return (
    <View
      accessibilityLabel={`${title}${description ? `. ${description}` : ''}`}
      className={`items-center justify-center px-8 py-12 ${className}`}
      style={{ minHeight: 160 }}
    >
      <Text className="text-4xl mb-4" style={{ fontSize: 48 }}>
        {icon}
      </Text>
      <Text
        className="text-center text-[16px] font-semibold mb-1.5"
        style={{ color: semanticColors.foreground }}
      >
        {title}
      </Text>
      {description ? (
        <Text
          className="text-center text-[14px] mb-4"
          style={{ color: semanticColors.secondaryText + '99' }}
        >
          {description}
        </Text>
      ) : null}
      {action ?? null}
    </View>
  );
}
