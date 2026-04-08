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

  it('centers medium-width layouts as floating panels', () => {
    expect(getPortalSurfaceMetrics(820, 'android')).toEqual({
      alignItems: 'center',
      panelWidth: 680,
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
