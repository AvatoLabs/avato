/**
 * LanguageSheet — Half-screen bottom sheet for language selection.
 */
import { Check } from 'lucide-react-native';
import React, { memo } from 'react';
import { Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptics } from '../../lib/haptics';
import { type Locale, useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';
import { tokens } from '../../theme/tokens';

const LANGUAGES: { code: Locale; label: string; name: string }[] = [
  { code: 'en-US', label: 'EN', name: 'English' },
  { code: 'zh-CN', label: 'CN', name: '简体中文' },
  { code: 'zh-TW', label: 'TW', name: '繁體中文' },
];

interface LanguageSheetProps {
  onClose: () => void;
  visible: boolean;
}

const LanguageSheet = memo<LanguageSheetProps>(({ visible, onClose }) => {
  const { locale, setLocale, t } = useI18n();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const handleSelect = async (code: Locale) => {
    haptics.selection();
    await setLocale(code);
    onClose();
  };

  return (
    <Modal
      accessibilityViewIsModal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Animated.View entering={enteringModalContent()} style={{ maxHeight: '50%' }}>
          <Pressable
            className="bg-card rounded-t-2xl"
            style={{ paddingBottom: Math.max(insets.bottom, 16) }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="items-center pt-3 pb-1">
              <View className="w-9 h-1 rounded-full bg-foreground/10" />
            </View>

            <View className="px-5 pb-2 pt-2">
              <Text className="text-foreground text-[18px] font-bold tracking-tight">
                {t.languageTitle}
              </Text>

              <View className="mt-4 rounded-2xl overflow-hidden bg-foreground/[0.04]">
                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                  {LANGUAGES.map((lang) => {
                    const active = locale === lang.code;
                    return (
                      <TouchableOpacity
                        activeOpacity={0.6}
                        className="flex-row items-center px-5 py-4 active:bg-foreground/5"
                        key={lang.code}
                        onPress={() => handleSelect(lang.code)}
                      >
                        <View
                          className="w-9 h-9 rounded-full items-center justify-center mr-4"
                          style={{ backgroundColor: active ? `${colors.primary}20` : undefined }}
                        >
                          <Text
                            className="text-[12px] font-semibold"
                            style={{ color: active ? colors.primary : colors.secondaryText }}
                          >
                            {lang.label}
                          </Text>
                        </View>
                        <Text
                          className="flex-1 text-[16px] font-medium tracking-tight"
                          style={{ color: active ? colors.primary : colors.foreground }}
                        >
                          {lang.name}
                        </Text>
                        {active && (
                          <Check
                            color={colors.primary}
                            size={20}
                            strokeWidth={tokens.icon.strokeWidth}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
});

LanguageSheet.displayName = 'LanguageSheet';

export default LanguageSheet;
