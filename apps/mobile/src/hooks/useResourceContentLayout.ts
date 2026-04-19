import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useMainTabBottomInsets,
  useMainTabScrollableContentPaddingBottom,
} from '../lib/bottomChrome';
import { getResponsiveLayoutMetrics } from '../lib/responsiveLayout';
import { tokens } from '../theme/tokens';

export function useResourceContentLayout() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const bottomChrome = useMainTabBottomInsets();
  const scrollListPaddingBottom = useMainTabScrollableContentPaddingBottom();
  const responsiveMetrics = getResponsiveLayoutMetrics(screenWidth, screenHeight);
  const contentChromeMaxWidth = responsiveMetrics.isWideTablet
    ? responsiveMetrics.rootHeaderMaxWidth
    : responsiveMetrics.settingsMaxWidth;
  const listSurfaceMaxWidth = responsiveMetrics.isWideTablet
    ? responsiveMetrics.rootHeaderMaxWidth
    : responsiveMetrics.settingsMaxWidth;
  const chromeHorizontalPadding = 24;
  const dropdownHorizontalPadding = responsiveMetrics.isTablet
    ? Math.max(Math.round((screenWidth - responsiveMetrics.rootHeaderMaxWidth) / 2) + 20, 20)
    : 20;
  const dropdownTopPadding = responsiveMetrics.isTablet
    ? Math.max(insets.top + tokens.mobile.heights.headerContent + 20, 96)
    : 96;
  const headerMenuMinWidth = responsiveMetrics.isTablet ? 224 : 208;
  const sortMenuMinWidth = responsiveMetrics.isTablet ? 196 : 180;
  const breadcrumbLabelMaxWidth = responsiveMetrics.isTablet ? 140 : 80;
  const chromeContainerStyle = responsiveMetrics.isTablet
    ? {
        alignSelf: 'center' as const,
        maxWidth: contentChromeMaxWidth,
        paddingHorizontal: chromeHorizontalPadding,
        width: '100%' as const,
      }
    : undefined;
  const listStyle = responsiveMetrics.isTablet
    ? ({
        alignSelf: 'center',
        maxWidth: listSurfaceMaxWidth,
        width: '100%',
      } as const)
    : undefined;
  const gridColumnCount = responsiveMetrics.isWideTablet ? 4 : 3;
  const floatingActionRightPadding = responsiveMetrics.isTablet
    ? Math.max(Math.round((screenWidth - listSurfaceMaxWidth) / 2) + 20, 20)
    : 20;

  return {
    bottomChrome,
    breadcrumbLabelMaxWidth,
    chromeContainerStyle,
    chromeHorizontalPadding,
    dropdownHorizontalPadding,
    dropdownTopPadding,
    floatingActionRightPadding,
    gridColumnCount,
    headerMenuMinWidth,
    insets,
    listStyle,
    responsiveMetrics,
    scrollListPaddingBottom,
    sortMenuMinWidth,
  };
}
