/**
 * LanguagePickerScreen — Select app language with i18n.
 */
import { ArrowLeft, Check } from 'lucide-react-native';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ui/ScreenHeader';
import { type Locale, useI18n } from '../lib/i18n';
import { tokens } from '../theme/tokens';

const LANGUAGES: { code: Locale; label: string; name: string }[] = [
  { code: 'en-US', label: 'EN', name: 'English' },
  { code: 'zh-CN', label: 'CN', name: '简体中文' },
  { code: 'zh-TW', label: 'TW', name: '繁體中文' },
  { code: 'ja-JP', label: 'JP', name: '日本語' },
];

export default function LanguagePickerScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const { locale, setLocale, t } = useI18n();

  const handleSelect = async (code: Locale) => {
    await setLocale(code);
    setTimeout(() => navigation.goBack(), 150);
  };

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t.languageTitle}
        leftElement={<ArrowLeft color="#111" size={22} strokeWidth={tokens.icon.strokeWidth} />}
        onPressLeft={() => navigation.goBack()}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        <View className="mx-5 rounded-2xl overflow-hidden bg-foreground/5">
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              activeOpacity={0.6}
              className="flex-row items-center px-5 py-4 active:bg-foreground/5"
              key={lang.code}
              onPress={() => handleSelect(lang.code)}
            >
              <View className="w-8 h-8 rounded-full bg-foreground/5 items-center justify-center mr-4">
                <Text className="text-foreground/60 text-[11px] font-semibold">{lang.label}</Text>
              </View>
              <Text
                className={`flex-1 text-[15.5px] font-medium tracking-tight ${locale === lang.code ? 'text-primary' : 'text-foreground'}`}
              >
                {lang.name}
              </Text>
              {locale === lang.code && (
                <Check color="#007aff" size={20} strokeWidth={tokens.icon.strokeWidth} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
