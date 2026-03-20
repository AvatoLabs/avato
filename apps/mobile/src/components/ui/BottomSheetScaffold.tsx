import React from 'react';
import {
  type DimensionValue,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';

interface BottomSheetScaffoldProps {
  children: React.ReactNode;
  description?: string;
  headerRight?: React.ReactNode;
  keyboardAvoiding?: boolean;
  maxHeight?: DimensionValue;
  onClose: () => void;
  title?: string;
  visible: boolean;
}

export function BottomSheetScaffold({
  children,
  description,
  headerRight,
  keyboardAvoiding = false,
  maxHeight = '72%',
  onClose,
  title,
  visible,
}: BottomSheetScaffoldProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const content = (
    <Animated.View entering={enteringModalContent()} style={{ maxHeight }}>
      <Pressable
        className="rounded-t-2xl"
        style={{
          backgroundColor: colors.card,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
        onPress={(event) => event.stopPropagation()}
      >
        <View className="items-center pb-1 pt-3">
          <View
            className="h-1 w-9 rounded-full"
            style={{ backgroundColor: colors.borderDefault }}
          />
        </View>

        {title || description || headerRight ? (
          <View className="px-5 pb-2 pt-1">
            {title || headerRight ? (
              <View className="flex-row items-center justify-between">
                <Text
                  className="flex-1 text-[18px] font-bold tracking-tight"
                  style={{ color: colors.foreground }}
                >
                  {title}
                </Text>
                {headerRight ? <View className="ml-4">{headerRight}</View> : null}
              </View>
            ) : null}
            {description ? (
              <Text className="mt-1 text-[13px] leading-5" style={{ color: colors.secondaryText }}>
                {description}
              </Text>
            ) : null}
          </View>
        ) : null}

        {children}
      </Pressable>
    </Animated.View>
  );

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Pressable
          className="flex-1 justify-end"
          style={{ backgroundColor: colors.modalOverlay }}
          onPress={onClose}
        >
          {keyboardAvoiding ? (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ maxHeight }}
            >
              {content}
            </KeyboardAvoidingView>
          ) : (
            content
          )}
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
