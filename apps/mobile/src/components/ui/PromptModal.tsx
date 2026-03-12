import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, TouchableOpacity, View } from 'react-native';

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
  submitLabel = 'OK',
  keyboardType = 'default',
  onSubmit,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<TextInput>(null);

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
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <Pressable className="flex-1 justify-center items-center bg-black/40" onPress={onCancel}>
        <Pressable
          className="bg-white rounded-2xl mx-10 w-[300px] overflow-hidden"
          onPress={(e) => e.stopPropagation()}
        >
          <View className="px-5 pt-5 pb-3">
            <Text className="text-foreground text-[16px] font-semibold text-center mb-3">
              {title}
            </Text>
            <TextInput
              autoFocus
              className="bg-foreground/5 rounded-xl px-3.5 py-2.5 text-foreground text-[15px]"
              keyboardType={keyboardType}
              placeholder={placeholder}
              placeholderTextColor="#999"
              ref={inputRef}
              returnKeyType="done"
              value={value}
              onChangeText={setValue}
              onSubmitEditing={handleSubmit}
            />
          </View>
          <View className="flex-row border-t border-black/10">
            <TouchableOpacity
              activeOpacity={0.6}
              className="flex-1 py-3.5 items-center border-r border-black/10"
              onPress={onCancel}
            >
              <Text className="text-[16px] text-gray-500 font-medium">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.6}
              className="flex-1 py-3.5 items-center"
              onPress={handleSubmit}
            >
              <Text className="text-[16px] text-primary font-semibold">{submitLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
