/**
 * ThemePickerScreen — App theme display (light-only).
 */
import { ArrowLeft, Check, Sun } from 'lucide-react-native';
import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

export default function ThemePickerScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.themeTitle}
        leftElement={<ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
        onPressLeft={() => navigation.goBack()}
      />

      <View className="px-5 pt-6">
        <View className="rounded-2xl overflow-hidden bg-foreground/5">
          <View className="flex-row items-center px-5 py-4">
            <View className="w-8 h-8 rounded-full bg-foreground/5 items-center justify-center mr-4">
              <Sun color="#007aff" size={16} strokeWidth={tokens.icon.strokeWidth} />
            </View>
            <Text className="flex-1 text-[15.5px] font-medium tracking-tight text-primary">
              {t.themeLight}
            </Text>
            <Check color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />
          </View>
        </View>

        <Text className="text-secondary/50 text-[12px] mt-4 px-1 leading-5 font-medium">
          {t.themeDesc}
        </Text>
      </View>
    </View>
  );
}
