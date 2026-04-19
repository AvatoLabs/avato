import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { resolveTagColor, TAG_COLOR_OPTIONS, withAlpha } from '../../constants/tags';
import { useI18n } from '../../lib/i18n';
import { getResponsiveLayoutMetrics } from '../../lib/responsiveLayout';
import { useThemeColors } from '../../theme/colors';

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
  const { t } = useI18n();
  const colors = useThemeColors();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const panelWidth = Math.min(
    Math.max(screenWidth - 32, 0),
    responsiveMetrics.isTablet ? 560 : screenWidth,
  );
  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 bg-black/40"
        style={{
          justifyContent: responsiveMetrics.isTablet ? 'center' : 'flex-end',
          paddingHorizontal: responsiveMetrics.isTablet ? 16 : 0,
          paddingVertical: responsiveMetrics.isTablet ? 24 : 0,
        }}
        onPress={onCancel}
      >
        <Pressable
          className={responsiveMetrics.isTablet ? 'rounded-3xl' : 'rounded-t-2xl'}
          style={{
            alignSelf: 'center',
            backgroundColor: colors.card,
            maxHeight: '78%',
            width: responsiveMetrics.isTablet ? panelWidth : undefined,
          }}
          onPress={(event) => event.stopPropagation()}
        >
          <View className="items-center pt-3 pb-2">
            <View className="h-1 w-9 rounded-full bg-foreground/10" />
          </View>

          <View className="px-5 pb-4 pt-1">
            <Text
              className="text-[18px] font-bold tracking-tight"
              style={{ color: colors.foreground }}
            >
              {title}
            </Text>
          </View>

          <ScrollView
            className="px-5"
            contentContainerStyle={{ gap: 18, paddingBottom: 28 }}
            keyboardShouldPersistTaps="handled"
          >
            <View>
              <Text
                className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wider"
                style={{ color: colors.secondaryText }}
              >
                {t.agentConfigName}
              </Text>
              <TextInput
                autoFocus
                className="rounded-2xl px-4 py-3 text-[15px] font-medium"
                placeholder={placeholder}
                placeholderTextColor={colors.secondaryText}
                style={{ backgroundColor: colors.fillTertiary, color: colors.foreground }}
                value={name}
                onChangeText={onChangeName}
              />
            </View>

            <View>
              <Text
                className="mb-2 px-1 text-[12px] font-medium uppercase tracking-wider"
                style={{ color: colors.secondaryText }}
              >
                {colorLabel}
              </Text>
              <View
                className="rounded-2xl px-3 py-3"
                style={{ backgroundColor: colors.fillQuaternary }}
              >
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
                className="items-center rounded-2xl px-4 py-3"
                style={{ backgroundColor: colors.primary }}
                onPress={onSubmit}
              >
                <Text className="text-[15px] font-semibold" style={{ color: colors.iconOnPrimary }}>
                  {submitLabel}
                </Text>
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
                className="items-center rounded-2xl px-4 py-3"
                style={{ backgroundColor: colors.fillTertiary }}
                onPress={onCancel}
              >
                <Text className="text-[14px] font-medium" style={{ color: colors.secondaryText }}>
                  {cancelLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
