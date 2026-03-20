import React from 'react';
import { Text, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import { SelectionBadge } from './ChoiceControls';
import PressableScale from './PressableScale';

interface SelectionListItemProps {
  accessibilityLabel?: string;
  className?: string;
  leading?: React.ReactNode;
  meta?: React.ReactNode;
  onPress?: () => void;
  rightAccessory?: React.ReactNode;
  selected?: boolean;
  subtitle?: string;
  subtitleNumberOfLines?: number;
  title: string;
  titleNumberOfLines?: number;
}

interface SelectionSectionLabelProps {
  leading?: React.ReactNode;
  title: string;
}

export function SelectionListItem({
  accessibilityLabel,
  className = '',
  leading,
  meta,
  onPress,
  rightAccessory,
  selected = false,
  subtitle,
  subtitleNumberOfLines = 2,
  title,
  titleNumberOfLines = 1,
}: SelectionListItemProps) {
  const colors = useThemeColors();

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityRole="button"
      className={`overflow-hidden rounded-2xl border ${className}`}
      disabled={!onPress}
      style={{
        backgroundColor: selected ? colors.primarySubtle : colors.fillQuaternary,
        borderColor: selected ? colors.primaryBorder : colors.borderSubtle,
        borderWidth: 1,
      }}
      onPress={onPress}
    >
      <View className="flex-row items-center px-4 py-3.5">
        {leading ? <View className="mr-3">{leading}</View> : null}

        <View className="flex-1">
          <Text
            className="font-semibold tracking-tight"
            numberOfLines={titleNumberOfLines}
            style={{
              color: selected ? colors.primary : colors.foreground,
              fontSize: tokens.typography.mobile.body,
            }}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              className="mt-0.5"
              numberOfLines={subtitleNumberOfLines}
              style={{
                color: colors.secondaryText,
                fontSize: tokens.typography.mobile.meta,
                lineHeight: tokens.typography.mobile.meta + 6,
              }}
            >
              {subtitle}
            </Text>
          ) : null}
          {meta ? <View className="mt-1 flex-row flex-wrap gap-1.5">{meta}</View> : null}
        </View>

        <View className="ml-3">{rightAccessory ?? <SelectionBadge selected={selected} />}</View>
      </View>
    </PressableScale>
  );
}

export function SelectionSectionLabel({ leading, title }: SelectionSectionLabelProps) {
  const colors = useThemeColors();

  return (
    <View className="mb-2 mt-4 flex-row items-center px-5">
      {leading ? <View className="mr-2">{leading}</View> : null}
      <Text
        className="font-semibold uppercase tracking-wider"
        style={{ color: colors.secondaryText, fontSize: tokens.typography.mobile.meta }}
      >
        {title}
      </Text>
    </View>
  );
}
