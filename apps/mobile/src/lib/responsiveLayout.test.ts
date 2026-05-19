import { describe, expect, it } from 'vitest';

import { getResponsiveLayoutMetrics } from './responsiveLayout';

describe('getResponsiveLayoutMetrics', () => {
  it('keeps phone layouts compact', () => {
    expect(getResponsiveLayoutMetrics(430, 932)).toEqual({
      chatDirectoryWidth: 378,
      chatHomeMaxWidth: 840,
      createFeedMaxWidth: 840,
      createSidebarWidth: 366,
      headerMaxWidth: 1040,
      isTablet: false,
      isWideTablet: false,
      rootHeaderMaxWidth: 1180,
      settingsMaxWidth: 960,
      tabBarMaxWidth: 880,
    });
  });

  it('does not switch large phones to tablet mode before the breakpoint', () => {
    expect(getResponsiveLayoutMetrics(767, 1024)).toEqual({
      chatDirectoryWidth: 390,
      chatHomeMaxWidth: 840,
      createFeedMaxWidth: 840,
      createSidebarWidth: 420,
      headerMaxWidth: 1040,
      isTablet: false,
      isWideTablet: false,
      rootHeaderMaxWidth: 1180,
      settingsMaxWidth: 960,
      tabBarMaxWidth: 880,
    });
  });

  it('treats portrait tablets as centered single-column layouts', () => {
    expect(getResponsiveLayoutMetrics(834, 1194)).toEqual({
      chatDirectoryWidth: 390,
      chatHomeMaxWidth: 840,
      createFeedMaxWidth: 840,
      createSidebarWidth: 420,
      headerMaxWidth: 1040,
      isTablet: true,
      isWideTablet: false,
      rootHeaderMaxWidth: 1180,
      settingsMaxWidth: 960,
      tabBarMaxWidth: 880,
    });
  });

  it('only enables tablet mode at the explicit tablet breakpoint', () => {
    expect(getResponsiveLayoutMetrics(768, 1024)).toEqual({
      chatDirectoryWidth: 390,
      chatHomeMaxWidth: 840,
      createFeedMaxWidth: 840,
      createSidebarWidth: 420,
      headerMaxWidth: 1040,
      isTablet: true,
      isWideTablet: false,
      rootHeaderMaxWidth: 1180,
      settingsMaxWidth: 960,
      tabBarMaxWidth: 880,
    });
  });

  it('switches large landscape tablets to split-pane metrics', () => {
    expect(getResponsiveLayoutMetrics(1280, 800)).toEqual({
      chatDirectoryWidth: 358,
      chatHomeMaxWidth: 920,
      createFeedMaxWidth: 900,
      createSidebarWidth: 410,
      headerMaxWidth: 1040,
      isTablet: true,
      isWideTablet: true,
      rootHeaderMaxWidth: 1180,
      settingsMaxWidth: 960,
      tabBarMaxWidth: 880,
    });
  });
});
