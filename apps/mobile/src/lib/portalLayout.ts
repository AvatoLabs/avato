export interface PortalSurfaceMetrics {
  alignItems: 'center' | 'flex-end' | 'stretch';
  paddingBottom: number;
  paddingHorizontal: number;
  paddingTop: number;
  panelWidth?: number;
}

const SPACING_XS = 4;
const SPACING_SM = 8;
const SPACING_MD = 16;
const SPACING_LG = 24;
const SPACING_XL = 32;

export const getPortalSurfaceMetrics = (
  screenWidth: number,
  platform: 'android' | 'ios',
): PortalSurfaceMetrics => {
  const compactInset = platform === 'ios' ? SPACING_SM : SPACING_XS;

  if (screenWidth >= 960) {
    return {
      alignItems: 'flex-end',
      panelWidth: Math.min(Math.max(Math.round(screenWidth * 0.46), 520), 720),
      paddingBottom: SPACING_MD,
      paddingHorizontal: SPACING_LG,
      paddingTop: SPACING_MD,
    };
  }

  if (screenWidth >= 700) {
    return {
      alignItems: 'center',
      panelWidth: Math.min(screenWidth - SPACING_XL * 2, 680),
      paddingBottom: SPACING_SM,
      paddingHorizontal: SPACING_MD,
      paddingTop: SPACING_SM,
    };
  }

  return {
    alignItems: 'stretch',
    paddingBottom: compactInset,
    paddingHorizontal: compactInset,
    paddingTop: compactInset,
  };
};
