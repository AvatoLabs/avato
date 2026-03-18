import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { semanticColors } from '../../constants/colors';
import { useI18n } from '../../lib/i18n';

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
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<TextInput>(null);
  const finalSubmitLabel = submitLabel || t.confirm;

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 100);
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
        <Pressable
          className="bg-card rounded-2xl mx-10 w-[300px] overflow-hidden"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="px-5 pt-5 pb-3">
            <Text className="text-foreground text-[16px] font-semibold text-center mb-3">
              {title}
            </Text>
            <TextInput
              accessibilityLabel={placeholder ?? title}
              autoFocus
              className="bg-foreground/5 rounded-xl px-3.5 py-2.5 text-foreground text-[15px]"
              keyboardType={keyboardType}
              placeholder={placeholder}
              placeholderTextColor={semanticColors.muted}
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
              <Text className="text-[16px] text-foreground/50 font-medium">{t.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.6}
              className="flex-1 py-3.5 items-center"
              onPress={handleSubmit}
            >
              <Text className="text-[16px] text-primary font-semibold">{finalSubmitLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
