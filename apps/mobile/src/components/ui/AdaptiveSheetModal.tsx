import React from 'react';
import { type DimensionValue, Modal, Pressable, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getResponsiveLayoutMetrics } from '../../lib/responsiveLayout';

interface AdaptiveSheetModalProps {
  animationType?: 'fade' | 'none' | 'slide';
  children: React.ReactNode;
  maxHeight?: DimensionValue;
  onClose: () => void;
  overflowHidden?: boolean;
  paddingBottom?: number;
  preferredWidth?: number;
  visible: boolean;
}

export default function AdaptiveSheetModal({
  animationType = 'slide',
  children,
  maxHeight = '72%',
  onClose,
  overflowHidden = false,
  paddingBottom,
  preferredWidth = 560,
  visible,
}: AdaptiveSheetModalProps) {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const isFloatingPanel = responsiveMetrics.isTablet;
  const resolvedPaddingBottom =
    paddingBottom ?? (isFloatingPanel ? Math.max(insets.bottom, 16) : insets.bottom + 16);
  const panelWidth = Math.min(
    Math.max(screenWidth - 32, 0),
    responsiveMetrics.isWideTablet ? Math.max(preferredWidth, 680) : preferredWidth,
  );
  const panelClassName = [
    isFloatingPanel ? 'rounded-3xl' : 'rounded-t-2xl',
    'bg-card',
    overflowHidden ? 'overflow-hidden' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Modal
      accessibilityViewIsModal
      transparent
      animationType={animationType}
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40"
        style={{
          justifyContent: isFloatingPanel ? 'center' : 'flex-end',
          paddingHorizontal: isFloatingPanel ? 16 : 0,
          paddingVertical: isFloatingPanel ? 24 : 0,
        }}
        onPress={onClose}
      >
        <Pressable
          className={panelClassName}
          style={{
            alignSelf: 'center',
            maxHeight,
            paddingBottom: resolvedPaddingBottom,
            width: isFloatingPanel ? panelWidth : undefined,
          }}
          onPress={(event) => event.stopPropagation()}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
