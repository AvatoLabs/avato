import React from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';

interface CreateWorkbenchCardProps {
  action?: React.ReactNode;
  children?: React.ReactNode;
  eyebrow: string;
  summary?: string;
  title: string;
}

export function CreateWorkbenchCard({
  action,
  children,
  eyebrow,
  summary,
  title,
}: CreateWorkbenchCardProps) {
  const colors = useThemeColors();

  return (
    <View
      className="rounded-[28px] border px-4 py-4"
      style={{ backgroundColor: colors.card, borderColor: colors.borderSubtle }}
    >
      <View
        style={{
          alignItems: 'flex-start',
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: children ? 12 : 0,
        }}
      >
        <View className="flex-1 pr-3">
          <Text
            style={{
              color: colors.secondaryText,
              fontSize: 12,
              fontWeight: '600',
              letterSpacing: 0.3,
              marginBottom: 8,
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </Text>
          <Text style={{ color: colors.foreground, fontSize: 18, fontWeight: '700' }}>{title}</Text>
          {summary ? (
            <Text
              style={{
                color: colors.secondaryText,
                fontSize: 13,
                lineHeight: 19,
                marginTop: 6,
              }}
            >
              {summary}
            </Text>
          ) : null}
        </View>
        {action ? <View>{action}</View> : null}
      </View>
      {children}
    </View>
  );
}
