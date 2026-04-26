import React from 'react';
import {
  type DimensionValue,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getResponsiveLayoutMetrics } from '../../lib/responsiveLayout';
import { useThemeColors } from '../../theme/colors';
import { enteringModalContent } from '../../theme/motion';

interface BottomSheetScaffoldProps {
  children: React.ReactNode;
  description?: string;
  headerRight?: React.ReactNode;
  keyboardAvoiding?: boolean;
  maxHeight?: DimensionValue;
  onClose: () => void;
  preferredWidth?: number;
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
  preferredWidth = 560,
  title,
  visible,
}: BottomSheetScaffoldProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const isFloatingPanel = responsiveMetrics.isTablet;
  const panelWidth = Math.min(
    Math.max(screenWidth - 32, 0),
    responsiveMetrics.isWideTablet ? Math.max(preferredWidth, 680) : preferredWidth,
  );

  const content = (
    <Animated.View
      entering={enteringModalContent()}
      style={{
        alignSelf: 'center',
        maxHeight,
        width: isFloatingPanel ? panelWidth : '100%',
      }}
    >
      <View
        className={isFloatingPanel ? 'rounded-3xl' : 'rounded-t-2xl'}
        style={{
          backgroundColor: colors.card,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
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
      </View>
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
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{
              flex: 1,
              justifyContent: isFloatingPanel ? 'center' : 'flex-end',
              paddingHorizontal: isFloatingPanel ? 16 : 0,
              paddingVertical: isFloatingPanel ? 24 : 0,
            }}
          >
            <Pressable
              className="absolute inset-0"
              style={{ backgroundColor: colors.modalOverlay }}
              onPress={onClose}
            />
            {content}
          </KeyboardAvoidingView>
        ) : (
          <View
            className="flex-1"
            style={{
              justifyContent: isFloatingPanel ? 'center' : 'flex-end',
              paddingHorizontal: isFloatingPanel ? 16 : 0,
              paddingVertical: isFloatingPanel ? 24 : 0,
            }}
          >
            <Pressable
              className="absolute inset-0"
              style={{ backgroundColor: colors.modalOverlay }}
              onPress={onClose}
            />
            {content}
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}
