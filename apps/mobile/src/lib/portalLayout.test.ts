import { describe, expect, it } from 'vitest';

import { getPortalSurfaceMetrics } from './portalLayout';

describe('getPortalSurfaceMetrics', () => {
  it('keeps phone layouts full-width', () => {
    expect(getPortalSurfaceMetrics(430, 'ios')).toEqual({
      alignItems: 'stretch',
      paddingBottom: 8,
      paddingHorizontal: 8,
      paddingTop: 8,
    });
  });

  it('keeps wide phones on the full-width branch before the floating-panel breakpoint', () => {
    expect(getPortalSurfaceMetrics(699, 'android')).toEqual({
      alignItems: 'stretch',
      paddingBottom: 4,
      paddingHorizontal: 4,
      paddingTop: 4,
    });
  });

  it('centers medium-width layouts as floating panels', () => {
    expect(getPortalSurfaceMetrics(820, 'android')).toEqual({
      alignItems: 'center',
      panelWidth: 680,
      paddingBottom: 8,
      paddingHorizontal: 16,
      paddingTop: 8,
    });
  });

  it('only enables floating panels starting at the medium-width breakpoint', () => {
    expect(getPortalSurfaceMetrics(700, 'android')).toEqual({
      alignItems: 'center',
      panelWidth: 636,
      paddingBottom: 8,
      paddingHorizontal: 16,
      paddingTop: 8,
    });
  });

  it('anchors wide layouts to the trailing edge as split panels', () => {
    expect(getPortalSurfaceMetrics(1200, 'ios')).toEqual({
      alignItems: 'flex-end',
      panelWidth: 552,
      paddingBottom: 16,
      paddingHorizontal: 24,
      paddingTop: 16,
    });
  });
});
