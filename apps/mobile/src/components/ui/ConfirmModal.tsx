/**
 * ConfirmModal — A Modal-based confirmation dialog.
 * Use instead of Alert.alert when inside another Modal/Sheet to avoid
 * "Tried to show an alert while not attached to an Activity" on Android.
 */
import React from 'react';
import { Modal, Pressable, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { getResponsiveLayoutMetrics } from '../../lib/responsiveLayout';
import { useThemeColors } from '../../theme/colors';
import { enteringDialogContent } from '../../theme/motion';

interface ConfirmModalProps {
  cancelLabel?: string;
  confirmLabel?: string;
  destructive?: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  visible: boolean;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const colors = useThemeColors();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const dialogWidth = responsiveMetrics.isTablet
    ? Math.min(Math.max(screenWidth - 32, 0), 420)
    : 300;

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onCancel}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/40"
        style={{
          paddingHorizontal: responsiveMetrics.isTablet ? 16 : 0,
          paddingVertical: responsiveMetrics.isTablet ? 24 : 0,
        }}
        onPress={onCancel}
      >
        <Animated.View entering={enteringDialogContent()} style={{ width: dialogWidth }}>
          <Pressable
            className="bg-card overflow-hidden rounded-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-5 pt-5 pb-3">
              <Text className="text-foreground text-[16px] font-semibold text-center mb-2">
                {title}
              </Text>
              <Text className="text-secondaryText text-[14px] text-center">{message}</Text>
            </View>
            <View className="flex-row mt-px bg-foreground/[0.04]" style={{ borderTopWidth: 0 }}>
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-1 py-3.5 items-center"
                onPress={onCancel}
              >
                <Text className="text-[16px] font-medium" style={{ color: colors.secondaryText }}>
                  {cancelLabel}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.6}
                className="flex-1 py-3.5 items-center"
                onPress={() => {
                  onConfirm();
                }}
              >
                <Text
                  className="text-[16px] font-semibold"
                  style={{ color: destructive ? colors.danger : colors.primary }}
                >
                  {confirmLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
