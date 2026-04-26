import React from 'react';
import { Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { getPortalSurfaceMetrics } from '../../lib/portalLayout';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';

interface PortalSurfaceProps {
  active?: boolean;
  children: React.ReactNode;
  onDismiss?: () => void;
}

export default function PortalSurface({ active = true, children, onDismiss }: PortalSurfaceProps) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();

  if (!active) return <>{children}</>;

  const metrics = getPortalSurfaceMetrics(width, Platform.OS === 'ios' ? 'ios' : 'android');

  return (
    <View
      className="flex-1"
      style={{
        alignItems: metrics.alignItems,
        backgroundColor: colors.modalOverlay,
        paddingBottom: metrics.paddingBottom,
        paddingHorizontal: metrics.paddingHorizontal,
        paddingTop: metrics.paddingTop,
      }}
    >
      {onDismiss ? <Pressable style={StyleSheet.absoluteFillObject} onPress={onDismiss} /> : null}
      <View
        className="flex-1"
        style={{
          ...(metrics.panelWidth ? { width: metrics.panelWidth } : { width: '100%' }),
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.xl + tokens.spacing.xs,
          borderWidth: StyleSheet.hairlineWidth,
          elevation: Platform.OS === 'android' ? 10 : 0,
          overflow: 'hidden',
          shadowColor: colors.shadow,
          shadowOffset: { height: 12, width: 0 },
          shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0,
          shadowRadius: 24,
        }}
      >
        {children}
      </View>
    </View>
  );
}
