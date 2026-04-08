import React from 'react';
import { KeyboardAvoidingView, type KeyboardAvoidingViewProps, View } from 'react-native';

import PortalSurface from './PortalSurface';
import { ScreenHeader } from './ScreenHeader';

interface PortalKeyboardScaffoldProps {
  active?: boolean;
  behavior?: KeyboardAvoidingViewProps['behavior'];
  children: React.ReactNode;
  headerChildren?: React.ReactNode;
  keyboardVerticalOffset?: number;
  leftElement?: React.ReactNode;
  onDismiss?: () => void;
  onPressLeft?: () => void;
  portalCurrentLabel?: string;
  portalRouteName?: string;
  portalRouteParams?: unknown;
  rightActions?: React.ReactNode;
  subtitle?: string;
  title: string;
}

export default function PortalKeyboardScaffold({
  active = true,
  behavior,
  children,
  headerChildren,
  keyboardVerticalOffset,
  leftElement,
  onDismiss,
  onPressLeft,
  portalCurrentLabel,
  portalRouteName,
  portalRouteParams,
  rightActions,
  subtitle,
  title,
}: PortalKeyboardScaffoldProps) {
  return (
    <PortalSurface active={active} onDismiss={onDismiss}>
      <KeyboardAvoidingView
        behavior={behavior}
        className="flex-1 bg-background"
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View className="flex-1 bg-background">
          <ScreenHeader
            leftElement={leftElement}
            portalCurrentLabel={portalCurrentLabel}
            portalRouteName={portalRouteName}
            portalRouteParams={portalRouteParams}
            rightActions={rightActions}
            subtitle={subtitle}
            title={title}
            onPressLeft={onPressLeft}
          >
            {headerChildren}
          </ScreenHeader>
          {children}
        </View>
      </KeyboardAvoidingView>
    </PortalSurface>
  );
}
