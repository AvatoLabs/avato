export interface ResponsiveLayoutMetrics {
  chatDirectoryWidth: number;
  chatHomeMaxWidth: number;
  createFeedMaxWidth: number;
  createSidebarWidth: number;
  headerMaxWidth: number;
  isTablet: boolean;
  isWideTablet: boolean;
  rootHeaderMaxWidth: number;
  settingsMaxWidth: number;
  tabBarMaxWidth: number;
}

const TABLET_BREAKPOINT = 768;
const WIDE_TABLET_BREAKPOINT = 1100;
const LANDSCAPE_WIDE_TABLET_BREAKPOINT = 960;

const CHAT_DIRECTORY_PHONE_MAX_WIDTH = 390;
const CHAT_DIRECTORY_WIDE_MIN_WIDTH = 320;
const CHAT_DIRECTORY_WIDE_MAX_WIDTH = 400;

const CREATE_SIDEBAR_PHONE_MAX_WIDTH = 420;
const CREATE_SIDEBAR_WIDE_MIN_WIDTH = 360;
const CREATE_SIDEBAR_WIDE_MAX_WIDTH = 420;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getResponsiveLayoutMetrics = (
  screenWidth: number,
  screenHeight: number,
): ResponsiveLayoutMetrics => {
  const isTablet = screenWidth >= TABLET_BREAKPOINT;
  const isWideTablet =
    screenWidth >= WIDE_TABLET_BREAKPOINT ||
    (screenWidth > screenHeight && screenWidth >= LANDSCAPE_WIDE_TABLET_BREAKPOINT);

  return {
    chatDirectoryWidth: isWideTablet
      ? clamp(
          Math.round(screenWidth * 0.28),
          CHAT_DIRECTORY_WIDE_MIN_WIDTH,
          CHAT_DIRECTORY_WIDE_MAX_WIDTH,
        )
      : Math.min(Math.round(screenWidth * 0.88), CHAT_DIRECTORY_PHONE_MAX_WIDTH),
    chatHomeMaxWidth: isWideTablet ? 920 : 840,
    createFeedMaxWidth: isWideTablet ? 900 : 840,
    createSidebarWidth: isWideTablet
      ? clamp(
          Math.round(screenWidth * 0.32),
          CREATE_SIDEBAR_WIDE_MIN_WIDTH,
          CREATE_SIDEBAR_WIDE_MAX_WIDTH,
        )
      : Math.min(Math.round(screenWidth * 0.85), CREATE_SIDEBAR_PHONE_MAX_WIDTH),
    headerMaxWidth: 1040,
    isTablet,
    isWideTablet,
    rootHeaderMaxWidth: 1180,
    settingsMaxWidth: 960,
    tabBarMaxWidth: 880,
  };
};
