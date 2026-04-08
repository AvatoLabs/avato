import React, { memo, useMemo } from 'react';
import { View } from 'react-native';

import { getPortalTrail } from '../../lib/portalNavigation';
import { useThemeColors } from '../../theme/colors';
import PortalStackBar from './PortalStackBar';

interface PortalChromeBarProps {
  currentLabel?: string;
  routeName: string;
  routeParams: unknown;
}

const PortalChromeBar = memo<PortalChromeBarProps>(({ currentLabel, routeName, routeParams }) => {
  const colors = useThemeColors();
  const trail = useMemo(() => getPortalTrail(routeName, routeParams), [routeName, routeParams]);

  if (trail.length === 0) return null;

  return (
    <View className="pb-1">
      <View className="items-center pb-2 pt-0.5">
        <View
          className="rounded-full"
          style={{
            backgroundColor: colors.tertiaryText,
            height: 4,
            opacity: 0.7,
            width: 34,
          }}
        />
      </View>
      <PortalStackBar currentLabel={currentLabel} routeName={routeName} routeParams={routeParams} />
    </View>
  );
});

PortalChromeBar.displayName = 'PortalChromeBar';

export default PortalChromeBar;
