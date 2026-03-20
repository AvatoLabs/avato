import { Search } from 'lucide-react-native';
import React from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface SearchFieldProps extends TextInputProps {
  containerClassName?: string;
  rightElement?: React.ReactNode;
  size?: 'compact' | 'default';
}

export const SearchField = ({ ref, containerClassName = '', rightElement, size = 'default', ...props }: SearchFieldProps & { ref?: React.RefObject<TextInput | null> }) => {
    const colors = useThemeColors();
    const height =
      size === 'compact' ? tokens.mobile.heights.filterChip : tokens.mobile.heights.segmentedControl;

    return (
      <View
        className={`flex-row items-center rounded-full px-4 ${containerClassName}`}
        style={{
          backgroundColor: colors.fillTertiary,
          borderColor: colors.borderSubtle,
          borderWidth: 1,
          minHeight: height,
        }}
      >
        <Search color={colors.secondaryText} size={18} strokeWidth={tokens.icon.strokeWidth} />
        <TextInput
          className="flex-1 ml-2 text-foreground text-[16px] font-medium"
          placeholderTextColor={colors.secondaryText}
          ref={ref}
          {...props}
          accessibilityLabel={props.accessibilityLabel ?? props.placeholder ?? 'Search'}
        />
        {rightElement ? <View className="ml-2">{rightElement}</View> : null}
      </View>
    );
  };

SearchField.displayName = 'SearchField';
