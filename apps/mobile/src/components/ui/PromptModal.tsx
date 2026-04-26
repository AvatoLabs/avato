import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { useI18n } from '../../lib/i18n';
import { getResponsiveLayoutMetrics } from '../../lib/responsiveLayout';
import { useThemeColors } from '../../theme/colors';
import { enteringDialogContent } from '../../theme/motion';

interface PromptModalProps {
  defaultValue?: string;
  keyboardType?: 'default' | 'decimal-pad' | 'number-pad';
  onCancel: () => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  submitLabel?: string;
  title: string;
  visible: boolean;
}

export default function PromptModal({
  visible,
  title,
  placeholder,
  defaultValue = '',
  submitLabel,
  keyboardType = 'default',
  onSubmit,
  onCancel,
}: PromptModalProps) {
  const { t } = useI18n();
  const colors = useThemeColors();
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<TextInput>(null);
  const finalSubmitLabel = submitLabel || t.confirm;
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const dialogWidth = Math.min(
    Math.max(screenWidth - 32, 0),
    responsiveMetrics.isTablet ? 520 : 320,
  );

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
      const id = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(id);
    }
  }, [visible, defaultValue]);

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <Pressable className="flex-1 justify-center items-center bg-black/40" onPress={onCancel}>
        <Animated.View entering={enteringDialogContent()} style={{ width: dialogWidth }}>
          <Pressable
            className="bg-card rounded-2xl overflow-hidden"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-5 pt-5 pb-3">
              <Text className="text-foreground text-[16px] font-semibold text-center mb-3">
                {title}
              </Text>
              <TextInput
                autoFocus
                accessibilityLabel={placeholder ?? title}
                className="bg-foreground/5 rounded-xl px-3.5 py-2.5 text-foreground text-[15px]"
                keyboardType={keyboardType}
                placeholder={placeholder}
                placeholderTextColor={colors.muted}
                ref={inputRef}
                returnKeyType="done"
                value={value}
                onChangeText={setValue}
                onSubmitEditing={handleSubmit}
              />
            </View>
            <View className="flex-row mt-px bg-foreground/[0.04]" style={{ borderTopWidth: 0 }}>
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-1 py-3.5 items-center"
                onPress={onCancel}
              >
                <Text className="text-[16px] font-medium" style={{ color: colors.secondaryText }}>
                  {t.cancel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-1 py-3.5 items-center"
                onPress={handleSubmit}
              >
                <Text className="text-[16px] font-semibold" style={{ color: colors.primary }}>
                  {finalSubmitLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
