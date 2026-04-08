import React from 'react';
import { View } from 'react-native';

import PortalSurface from './PortalSurface';
import { ScreenHeader } from './ScreenHeader';

interface PortalScaffoldProps {
  active?: boolean;
  children: React.ReactNode;
  headerChildren?: React.ReactNode;
  headerLevel?: 'default' | 'root';
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

export default function PortalScaffold({
  active = true,
  children,
  headerChildren,
  headerLevel,
  leftElement,
  onDismiss,
  onPressLeft,
  portalCurrentLabel,
  portalRouteName,
  portalRouteParams,
  rightActions,
  subtitle,
  title,
}: PortalScaffoldProps) {
  return (
    <PortalSurface active={active} onDismiss={onDismiss}>
      <View className="flex-1 bg-background">
        <ScreenHeader
          headerLevel={headerLevel}
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
    </PortalSurface>
  );
}
