import React from 'react';
import {
  Modal,
  Pressable,
  type TouchableOpacityProps,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface MediaPreviewScaffoldProps {
  actions?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  visible: boolean;
}

interface MediaPreviewActionButtonProps
  extends Omit<TouchableOpacityProps, 'style' | 'children' | 'accessibilityRole'> {
  children: React.ReactNode;
}

export function MediaPreviewActionButton({
  children,
  ...props
}: MediaPreviewActionButtonProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.78}
      className="h-11 w-11 items-center justify-center rounded-full"
      style={{ backgroundColor: colors.mediaScrim }}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
}

export function MediaPreviewScaffold({
  actions,
  children,
  onClose,
  visible,
}: MediaPreviewScaffoldProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View className="flex-1" style={{ backgroundColor: colors.mediaBackdrop }}>
        <Pressable className="absolute inset-0" onPress={onClose} />

        {actions ? (
          <View
            className="absolute left-4 right-4 z-10 flex-row justify-end"
            style={{ gap: tokens.spacing.sm, top: insets.top + 8 }}
          >
            {actions}
          </View>
        ) : null}

        <View className="flex-1 items-center justify-center">{children}</View>
      </View>
    </Modal>
  );
}
