import { Search } from 'lucide-react-native';
import React from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface SearchFieldProps extends TextInputProps {
  containerClassName?: string;
}

export function SearchField({ containerClassName = '', ...props }: SearchFieldProps) {
  const colors = useThemeColors();
  return (
    <View
      className={`flex-row items-center px-4 h-11 rounded-full border border-border ${containerClassName}`}
    >
      <Search color={colors.secondaryText} size={18} strokeWidth={tokens.icon.strokeWidth} />
      <TextInput
        className="flex-1 ml-2 text-foreground text-[16px] font-medium"
        placeholderTextColor={colors.secondaryText}
        {...props}
        accessibilityLabel={props.accessibilityLabel ?? props.placeholder ?? 'Search'}
      />
    </View>
  );
}
