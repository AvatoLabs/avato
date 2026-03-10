import { Search } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { TextInput, type TextInputProps,View } from 'react-native';

import { tokens } from '../../theme/tokens';

interface SearchFieldProps extends TextInputProps {
  containerClassName?: string;
}

export function SearchField({ containerClassName = '', ...props }: SearchFieldProps) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <View className={`flex-row items-center px-4 h-11 rounded-full bg-foreground/5 dark:bg-white/10 border border-black/5 dark:border-white/10 ${containerClassName}`}>
      <Search
        color={isDark ? '#a6a6a6' : '#8c8c8c'}
        size={18}
        strokeWidth={tokens.icon.strokeWidth}
      />
      <TextInput
        className="flex-1 ml-2 text-foreground text-[16px] font-medium"
        placeholderTextColor={isDark ? '#a6a6a6' : '#8c8c8c'}
        {...props}
      />
    </View>
  );
}
