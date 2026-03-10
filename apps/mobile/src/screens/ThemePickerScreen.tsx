/**
 * ThemePickerScreen — Select app theme with i18n.
 */
import { ArrowLeft, Check, Monitor, Moon, Sun } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

export default function ThemePickerScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { colorScheme, setColorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { t } = useI18n();

  const THEMES = [
    { icon: Sun, key: 'light', label: t.themeLight },
    { icon: Moon, key: 'dark', label: t.themeDark },
    { icon: Monitor, key: 'system', label: t.themeSystem },
  ] as const;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.themeTitle}
        leftElement={
          <ArrowLeft color={isDark ? '#fff' : '#111'} size={22} strokeWidth={tokens.icon.strokeWidth} />
        }
        onPressLeft={() => navigation.goBack()}
      />

      <View className="px-5 pt-6">
        <View className="rounded-2xl overflow-hidden bg-foreground/5 dark:bg-white/5">
          {THEMES.map((theme, i) => {
            const IconComp = theme.icon;
            const isActive = colorScheme === theme.key;
            return (
              <TouchableOpacity
                activeOpacity={0.6}
                className={`flex-row items-center px-5 py-4 active:bg-foreground/5 ${i > 0 ? 'mt-px' : ''}`}
                key={theme.key}
                onPress={() => setColorScheme(theme.key as any)}
              >
                <View className="w-8 h-8 rounded-full bg-foreground/5 dark:bg-white/5 items-center justify-center mr-4">
                  <IconComp
                    color={isActive ? '#007aff' : isDark ? '#888' : '#666'}
                    size={16}
                    strokeWidth={tokens.icon.strokeWidth}
                  />
                </View>
                <Text className={`flex-1 text-[15.5px] font-medium tracking-tight ${isActive ? 'text-primary' : 'text-foreground'}`}>
                  {theme.label}
                </Text>
                {isActive && <Check color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text className="text-secondary/50 text-[12px] mt-4 px-1 leading-5 font-medium">
          {t.themeDesc}
        </Text>
      </View>
    </View>
  );
}
