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

export function SegmentedControl<T extends string>({
  items,
  onChange,
  value,
}: SegmentedControlProps<T>) {
  const colors = useThemeColors();

  return (
    <View
      className="flex-row rounded-full p-1"
      style={{
        backgroundColor: colors.fillTertiary,
        minHeight: tokens.mobile.heights.segmentedControl,
      }}
    >
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;

        return (
          <TouchableOpacity
            accessibilityRole="button"
            activeOpacity={0.82}
            className="flex-1 flex-row items-center justify-center rounded-full px-4"
            key={item.value}
            style={{
              backgroundColor: active ? colors.primary : 'transparent',
              minHeight: tokens.mobile.heights.segmentedControl - 8,
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
                size={16}
                strokeWidth={tokens.icon.strokeWidth}
              />
            ) : null}
            <Text
              className={Icon ? 'ml-1.5 text-[14px] font-semibold' : 'text-[14px] font-semibold'}
              style={{ color: active ? colors.iconOnPrimary : colors.foreground }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function FilterChip({
  active = false,
  count,
  icon,
  label,
  ...props
}: FilterChipProps) {
  const colors = useThemeColors();
  const activeBackgroundColor = active ? colors.primaryMuted : colors.fillTertiary;
  const textColor = active ? colors.primary : colors.muted;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.72}
      className="flex-row items-center justify-center rounded-full px-4"
      style={{
        backgroundColor: activeBackgroundColor,
        borderColor: active ? colors.primaryBorder : 'transparent',
        borderWidth: 1,
        minHeight: tokens.mobile.heights.filterChip,
      }}
      {...props}
    >
      {icon ? <View className="mr-1.5">{icon}</View> : null}
      <Text className="text-[13px] font-semibold" style={{ color: textColor }}>
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
      <Text className="text-[11px] font-semibold" style={{ color: resolvedTextColor }}>
        {label}
      </Text>
    </View>
  );
}

export function SelectionBadge({ selected }: SelectionBadgeProps) {
  const colors = useThemeColors();

  return (
    <View
      className="h-5 w-5 items-center justify-center rounded-full border-2"
      style={{
        backgroundColor: selected ? colors.primaryMuted : colors.background,
        borderColor: selected ? colors.primary : colors.muted,
      }}
    >
      {selected ? <Check color={colors.primary} size={11} strokeWidth={2.6} /> : null}
    </View>
  );
}
