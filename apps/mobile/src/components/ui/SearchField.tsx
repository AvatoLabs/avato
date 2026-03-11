import { Search } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { themeColors } from '../../theme';
import { tokens } from '../../theme/tokens';

interface SearchFieldProps extends TextInputProps {
  containerClassName?: string;
}

export function SearchField({ containerClassName = '', ...props }: SearchFieldProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? themeColors.dark : themeColors.light;

  return (
    <View
      className={`flex-row items-center px-4 h-11 rounded-full border border-black/5 dark:border-white/[0.06] ${containerClassName}`}
    >
      <Search color={colors.secondary} size={18} strokeWidth={tokens.icon.strokeWidth} />
      <TextInput
        className="flex-1 ml-2 text-foreground text-[16px] font-medium"
        placeholderTextColor={colors.secondary}
        {...props}
      />
    </View>
  );
}
