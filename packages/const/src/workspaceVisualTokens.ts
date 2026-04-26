/**
 * Shared visual rhythm for desktop workspace shell & home.
 * Semantic colors still come from antd-style / ThemeProvider (cssVar).
 */

/**
 * Tabler outline icons via @lobehub/ui `Icon`: pass as `size.strokeWidth` (calcSize merges onto SVG).
 * Must match `ENTRY_ICON_STROKE` in app `config/entryIcons.ts`.
 */
export const WORKSPACE_ICON_STROKE_WIDTH = 1.85;

/** Draggable nav rail — slightly wider minimum for breathing room */
export const WORKSPACE_SHELL_RAIL_MIN_WIDTH = 252;

/** Qwen 式收起态：仅图标列宽度（与迷你侧栏一致） */
export const WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX = 56;

/** Primary nav row */
export const WORKSPACE_NAV_ROW_HEIGHT_PX = 38;

/**
 * Matches `NavItem` Block `paddingInline` — used to align brand row with nav labels.
 */
export const WORKSPACE_NAV_ITEM_BLOCK_PADDING_INLINE_PX = 8;

/** Icon column width in NavItem (`glassIconWell` vs non-glass `Center`) */
export const WORKSPACE_NAV_ITEM_ICON_COL_GLASS_PX = 32;
export const WORKSPACE_NAV_ITEM_ICON_COL_DEFAULT_PX = 30;

/** `gap` between icon column and title in NavItem Block */
export const WORKSPACE_NAV_ITEM_ICON_TITLE_GAP_PX = 10;

/** SubSidebar: outer `paddingInline` aligned with NavItem row wrappers (page search, resource, memory) */
export const WORKSPACE_SUB_SIDEBAR_ROW_PADDING_INLINE_PX = 4;

/** SubSidebar title row — back control (matches `BackButton` size in SubSidebarTitleBar) */
export const WORKSPACE_SUB_SIDEBAR_BACK_BUTTON_BLOCK_PX = 30;
export const WORKSPACE_SUB_SIDEBAR_BACK_TITLE_GAP_PX = 6;

/** Title bar: slightly taller than nav rows for hierarchy */
export const WORKSPACE_SUB_SIDEBAR_TITLE_BAR_MIN_HEIGHT_PX = 44;

/** Padding + back button + gap before title in SubSidebarTitleBar */
const WORKSPACE_SUB_SIDEBAR_BACK_CLUSTER_END_PX =
  WORKSPACE_SUB_SIDEBAR_ROW_PADDING_INLINE_PX +
  WORKSPACE_SUB_SIDEBAR_BACK_BUTTON_BLOCK_PX +
  WORKSPACE_SUB_SIDEBAR_BACK_TITLE_GAP_PX;

/** Left edge of NavItem title from sidebar left (SubSidebar rows). */
export function getWorkspaceSubSidebarNavLabelInsetPx(glass: boolean): number {
  const iconCol = glass
    ? WORKSPACE_NAV_ITEM_ICON_COL_GLASS_PX
    : WORKSPACE_NAV_ITEM_ICON_COL_DEFAULT_PX;

  return (
    WORKSPACE_SUB_SIDEBAR_ROW_PADDING_INLINE_PX +
    WORKSPACE_NAV_ITEM_BLOCK_PADDING_INLINE_PX +
    iconCol +
    WORKSPACE_NAV_ITEM_ICON_TITLE_GAP_PX
  );
}

/** `margin-inline-start` on title so it lines up with NavItem titles below */
export function getWorkspaceSubSidebarTitleMarginInlineStartPx(glass: boolean): number {
  return Math.max(
    0,
    getWorkspaceSubSidebarNavLabelInsetPx(glass) - WORKSPACE_SUB_SIDEBAR_BACK_CLUSTER_END_PX,
  );
}

/** Main home sidebar Nav wrapper `paddingInline` (see home `Nav.tsx`) */
export const WORKSPACE_HOME_SIDEBAR_NAV_ROW_PADDING_INLINE_PX = 6;

/** Home column — hero, composer, and lower modules share this grid */
export const WORKSPACE_HOME_COLUMN_MAX_WIDTH_PX = 1248;

/** Composer keeps pace with the wider home column on desktop */
export const WORKSPACE_COMPOSER_MAX_WIDTH_PX = 1248;

export const WORKSPACE_COMPOSER_MIN_HEIGHT_PX = 96;
export const WORKSPACE_COMPOSER_RADIUS_PX = 16;

/** Vertical rhythm between major home sections */
export const WORKSPACE_HOME_SECTION_GAP_PX = 22;

/** Crisp easing (aligned with common “standard” curve) */
export const WORKSPACE_EASE_STANDARD = 'cubic-bezier(0.4, 0, 0.2, 1)';

export const WORKSPACE_DURATION_FAST_MS = 150;
export const WORKSPACE_DURATION_NORMAL_MS = 200;
