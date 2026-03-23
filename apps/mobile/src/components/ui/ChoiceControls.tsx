import { Check } from 'lucide-react-native';
import React from 'react';
import { Text, TouchableOpacity, type TouchableOpacityProps, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface SegmentedControlItem<T extends string> {
  icon?: React.ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  label: string;
  value: T;
}

interface SegmentedControlProps<T extends string> {
  items: SegmentedControlItem<T>[];
  onChange: (value: T) => void;
  value: T;
}

interface FilterChipProps extends TouchableOpacityProps {
  active?: boolean;
  count?: number | string;
  icon?: React.ReactNode;
  label: string;
}

interface MetaTagProps {
  backgroundColor?: string;
  icon?: React.ReactNode;
  label: string;
  textColor?: string;
  tone?: 'accent' | 'neutral' | 'success';
}

interface SelectionBadgeProps {
  selected: boolean;
}

const CONTROL_ICON_SIZE = tokens.icon.size.sm - 1;
const SEGMENTED_CONTROL_PADDING = 3;
const SEGMENTED_HORIZONTAL_PADDING = tokens.spacing.sm + 4;
const SEGMENTED_LABEL_SIZE = tokens.typography.mobile.body - 2;
const FILTER_CHIP_LABEL_SIZE = tokens.typography.mobile.meta;
const META_TAG_LABEL_SIZE = tokens.typography.mobile.meta;
const SELECTION_BADGE_SIZE = 20;
const SELECTION_BADGE_ICON_SIZE = tokens.typography.mobile.meta;

export function SegmentedControl<T extends string>({
  items,
  onChange,
  value,
}: SegmentedControlProps<T>) {
  const colors = useThemeColors();

  return (
    <View
      className="flex-row rounded-full"
      style={{
        backgroundColor: colors.fillTertiary,
        minHeight: tokens.mobile.heights.segmentedControl,
        padding: SEGMENTED_CONTROL_PADDING,
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;

        return (
          <TouchableOpacity
            accessibilityLabel={item.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            activeOpacity={0.82}
            className="flex-1 flex-row items-center justify-center rounded-full"
            key={item.value}
            style={{
              backgroundColor: active ? colors.primary : 'transparent',
              minHeight: tokens.mobile.heights.segmentedControl - SEGMENTED_CONTROL_PADDING * 2,
              paddingHorizontal: SEGMENTED_HORIZONTAL_PADDING,
            }}
            onPress={() => {
              if (active) return;
              haptics.selection();
              onChange(item.value);
            }}
          >
            {Icon ? (
              <Icon
                color={active ? colors.iconOnPrimary : colors.secondaryText}
                size={CONTROL_ICON_SIZE}
                strokeWidth={tokens.icon.strokeWidth}
              />
            ) : null}
            <Text
              className={Icon ? 'ml-1 font-semibold' : 'font-semibold'}
              style={{
                color: active ? colors.iconOnPrimary : colors.foreground,
                fontSize: SEGMENTED_LABEL_SIZE,
              }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function FilterChip({ active = false, count, icon, label, ...props }: FilterChipProps) {
  const colors = useThemeColors();
  const activeBackgroundColor = active ? colors.primaryMuted : colors.fillTertiary;
  const textColor = active ? colors.primary : colors.muted;

  return (
    <TouchableOpacity
      accessibilityLabel={
        count !== undefined && count !== null && count !== '' ? `${label} ${count}` : label
      }
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      activeOpacity={0.72}
      className="flex-row items-center justify-center rounded-full px-3"
      style={{
        backgroundColor: activeBackgroundColor,
        borderColor: active ? colors.primaryBorder : 'transparent',
        borderWidth: 1,
        minHeight: tokens.mobile.heights.filterChip,
      }}
      {...props}
    >
      {icon ? <View className="mr-1">{icon}</View> : null}
      <Text
        className="font-semibold"
        style={{ color: textColor, fontSize: FILTER_CHIP_LABEL_SIZE }}
      >
        {label}
        {count !== undefined && count !== null && count !== '' ? ` ${count}` : ''}
      </Text>
    </TouchableOpacity>
  );
}

export function MetaTag({
  backgroundColor,
  icon,
  label,
  textColor,
  tone = 'neutral',
}: MetaTagProps) {
  const colors = useThemeColors();

  const resolvedBackgroundColor =
    backgroundColor ||
    (tone === 'accent'
      ? colors.primaryMuted
      : tone === 'success'
        ? colors.successMuted
        : colors.fillTertiary);
  const resolvedTextColor =
    textColor ||
    (tone === 'accent'
      ? colors.primary
      : tone === 'success'
        ? colors.success
        : colors.secondaryText);

  return (
    <View
      className="flex-row items-center rounded-full px-2.5"
      style={{
        backgroundColor: resolvedBackgroundColor,
        minHeight: tokens.mobile.heights.metaTag,
      }}
    >
      {icon ? <View className="mr-1">{icon}</View> : null}
      <Text
        className="font-semibold"
        style={{ color: resolvedTextColor, fontSize: META_TAG_LABEL_SIZE }}
      >
        {label}
      </Text>
    </View>
  );
}

export function SelectionBadge({ selected }: SelectionBadgeProps) {
  const colors = useThemeColors();

  return (
    <View
      className="items-center justify-center rounded-full border"
      style={{
        backgroundColor: selected ? colors.primarySubtle : colors.fillQuaternary,
        borderColor: selected ? colors.primaryBorder : colors.borderSubtle,
        height: SELECTION_BADGE_SIZE,
        width: SELECTION_BADGE_SIZE,
      }}
    >
      {selected ? (
        <Check
          color={colors.primary}
          size={SELECTION_BADGE_ICON_SIZE}
          strokeWidth={tokens.icon.strokeWidth + 0.5}
        />
      ) : null}
    </View>
  );
}
