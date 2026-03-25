/**
 * Shared visual rhythm for desktop workspace shell & home.
 * Semantic colors still come from antd-style / ThemeProvider (cssVar).
 */

/** Draggable nav rail — slightly wider minimum for breathing room */
export const WORKSPACE_SHELL_RAIL_MIN_WIDTH = 252;

/** Primary nav row */
export const WORKSPACE_NAV_ROW_HEIGHT_PX = 38;

/** Home column — hero, composer, and lower modules share this grid */
export const WORKSPACE_HOME_COLUMN_MAX_WIDTH_PX = 1120;

/** Composer emphasis — narrower than full column for focal weight */
export const WORKSPACE_COMPOSER_MAX_WIDTH_PX = 920;

export const WORKSPACE_COMPOSER_MIN_HEIGHT_PX = 96;
export const WORKSPACE_COMPOSER_RADIUS_PX = 16;

/** Vertical rhythm between major home sections */
export const WORKSPACE_HOME_SECTION_GAP_PX = 28;

/** Crisp easing (aligned with common “standard” curve) */
export const WORKSPACE_EASE_STANDARD = 'cubic-bezier(0.4, 0, 0.2, 1)';

export const WORKSPACE_DURATION_FAST_MS = 150;
export const WORKSPACE_DURATION_NORMAL_MS = 200;
