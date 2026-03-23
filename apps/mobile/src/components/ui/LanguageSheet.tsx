/**
 * LanguageSheet — Half-screen bottom sheet for language selection.
 */
import React, { memo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { haptics } from '../../lib/haptics';
import { type Locale, useI18n } from '../../lib/i18n';
import { useThemeColors } from '../../theme/colors';
import { BottomSheetScaffold } from './BottomSheetScaffold';
import { SelectionListItem } from './SelectionList';

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

  const handleSelect = (code: Locale) => {
    haptics.selection();
    if (code !== locale) {
      void setLocale(code);
    }
    onClose();
  };

  return (
    <BottomSheetScaffold
      maxHeight="50%"
      title={t.languageTitle}
      visible={visible}
      onClose={onClose}
    >
      <View className="px-5 pb-2">
        <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
          {LANGUAGES.map((lang) => {
            const active = locale === lang.code;

            return (
              <SelectionListItem
                key={lang.code}
                selected={active}
                title={lang.name}
                titleNumberOfLines={1}
                className={lang.code === LANGUAGES.at(-1)?.code ? '' : 'mb-2'}
                leading={
                  <View
                    className="h-10 w-10 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: active ? colors.primarySubtle : colors.fillTertiary,
                    }}
                  >
                    <Text
                      className="font-semibold"
                      style={{ color: active ? colors.primary : colors.secondaryText }}
                    >
                      {lang.label}
                    </Text>
                  </View>
                }
                onPress={() => handleSelect(lang.code)}
              />
            );
          })}
        </ScrollView>
      </View>
    </BottomSheetScaffold>
  );
});

LanguageSheet.displayName = 'LanguageSheet';

export default LanguageSheet;
