import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { semanticColors } from '../../constants/colors';
import { TAG_COLOR_OPTIONS, resolveTagColor, withAlpha } from '../../constants/tags';

interface TagEditorSheetProps {
  cancelLabel: string;
  color: string | null;
  colorLabel: string;
  deleteDescription?: string;
  deleteLabel?: string;
  name: string;
  onCancel: () => void;
  onChangeColor: (color: string | null) => void;
  onChangeName: (name: string) => void;
  onDelete?: () => void;
  onSubmit: () => void;
  placeholder: string;
  submitLabel: string;
  title: string;
  visible: boolean;
}

export function TagEditorSheet({
  cancelLabel,
  color,
  colorLabel,
  deleteDescription,
  deleteLabel,
  name,
  onCancel,
  onChangeColor,
  onChangeName,
  onDelete,
  onSubmit,
  placeholder,
  submitLabel,
  title,
  visible,
}: TagEditorSheetProps) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onCancel}>
        <Pressable
          className="rounded-t-2xl bg-white"
          style={{ maxHeight: '78%' }}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="items-center pt-3 pb-2">
            <View className="h-1 w-9 rounded-full bg-foreground/10" />
          </View>

          <View className="px-5 pb-4 pt-1">
            <Text className="text-[18px] font-bold tracking-tight text-foreground">{title}</Text>
          </View>

          <ScrollView
            className="px-5"
            contentContainerStyle={{ gap: 18, paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
                {title}
              </Text>
              <TextInput
                autoFocus
                className="rounded-2xl bg-foreground/[0.04] px-4 py-3 text-[15px] font-medium text-foreground"
                placeholder={placeholder}
                placeholderTextColor={semanticColors.secondaryText}
                value={name}
                onChangeText={onChangeName}
              />
            </View>

            <View>
              <Text className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-secondary/60">
                {colorLabel}
              </Text>
              <View className="rounded-2xl bg-foreground/[0.03] px-3 py-3">
                <View className="mb-3 flex-row items-center">
                  <View
                    className="mr-3 h-8 rounded-full border"
                    style={{
                      backgroundColor: withAlpha(color, '18'),
                      borderColor: withAlpha(color, '33'),
                      width: 48,
                    }}
                  />
                  <Text
                    className="text-[14px] font-semibold"
                    style={{ color: resolveTagColor(color) }}
                  >
                    {name.trim() || placeholder}
                  </Text>
                </View>

                <View className="flex-row flex-wrap" style={{ gap: 10 }}>
                  {TAG_COLOR_OPTIONS.map((option) => {
                    const active = resolveTagColor(color) === option;

                    return (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        className="items-center justify-center rounded-full border"
                        key={option}
                        style={{
                          backgroundColor: withAlpha(option, active ? '28' : '16'),
                          borderColor: active ? option : withAlpha(option, '44'),
                          height: 34,
                          width: 34,
                        }}
                        onPress={() => onChangeColor(option)}
                      >
                        <View
                          className="rounded-full"
                          style={{ backgroundColor: option, height: 16, width: 16 }}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                className="items-center rounded-2xl bg-primary px-4 py-3"
                onPress={onSubmit}
              >
                <Text className="text-[15px] font-semibold text-white">{submitLabel}</Text>
              </TouchableOpacity>

              {onDelete ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  className="rounded-2xl bg-red-500/10 px-4 py-3"
                  onPress={onDelete}
                >
                  <Text className="text-center text-[14px] font-semibold text-red-500">
                    {deleteLabel}
                  </Text>
                  {deleteDescription ? (
                    <Text className="mt-1 text-center text-[12px] leading-5 text-red-500/75">
                      {deleteDescription}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                activeOpacity={0.85}
                className="items-center rounded-2xl bg-foreground/[0.04] px-4 py-3"
                onPress={onCancel}
              >
                <Text className="text-[14px] font-medium text-foreground/55">{cancelLabel}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
