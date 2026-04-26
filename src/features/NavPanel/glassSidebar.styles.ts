import { createStaticStyles } from 'antd-style';

/**
 * Workspace glass chrome (rail + nested drawers) — uses antd-style `cssVar` (primary / neutral theme).
 * `color-mix` is only used for translucent frosted layers; the mixed channel is always a theme token.
 */
const GLASS_PANEL_SURFACE_MIX_PERCENT = 82;
const GLASS_BACKDROP_BLUR_PX = 20;
const GLASS_BACKDROP_SATURATE_PERCENT = 140;

export const glassSidebarStyles = createStaticStyles(({ css, cssVar }) => {
  const blur = `${GLASS_BACKDROP_BLUR_PX}px`;
  const sat = `${GLASS_BACKDROP_SATURATE_PERCENT}%`;

  const glassElevatedSurface = css`
    background: color-mix(
      in srgb,
      ${cssVar.colorBgElevated} ${GLASS_PANEL_SURFACE_MIX_PERCENT}%,
      transparent
    ) !important;
    backdrop-filter: blur(${blur}) saturate(${sat});
  `;

  return {
    /** Nested drawer / sheet mounted next to the rail (e.g. All agents, all topics). */
    drawerGlassBody: css`
      ${glassElevatedSurface}
      padding: 0 !important;
    `,
    drawerGlassHeader: css`
      ${glassElevatedSurface}
      padding: 0 !important;
      border-block-end: none !important;
    `,
    drawerGlassWrapper: css`
      border-inline-start: 1px solid ${cssVar.colorBorderSecondary};
      border-inline-end: 1px solid ${cssVar.colorBorderSecondary};
      box-shadow: 4px 0 16px -6px ${cssVar.colorFillTertiary};
    `,
    draggablePanelGlass: css`
      ${glassElevatedSurface}
      box-shadow:
        inset -1px 0 0 ${cssVar.colorBorderSecondary},
        inset 0 1px 0 color-mix(in srgb, ${cssVar.colorText} 6%, transparent);
    `,
    emptyNavIconWell: css`
      display: flex;
      flex: none;
      align-items: center;
      justify-content: center;

      width: 32px;
      height: 32px;
      border-radius: ${cssVar.borderRadiusLG};

      background: ${cssVar.colorFillQuaternary};
    `,
    emptyNavRow: css`
      border-radius: ${cssVar.borderRadiusSM};
      transition: background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

      &:hover {
        background: ${cssVar.colorFillQuaternary} !important;
      }
    `,
    footerZone: css`
      flex: none;
    `,
    groupHeader: css`
      font-size: ${cssVar.fontSizeSM} !important;
      font-weight: 500 !important;
      line-height: 1.25 !important;
      color: ${cssVar.colorTextSecondary} !important;
      text-transform: none !important;
      letter-spacing: 0.02em !important;
    `,
    hairlineDivider: css`
      flex: none;

      height: 1px;
      margin-block: 4px 0;
      margin-inline: 10px;

      opacity: 0.92;
      background: linear-gradient(
        90deg,
        transparent 0%,
        ${cssVar.colorSplit} 14%,
        ${cssVar.colorSplit} 86%,
        transparent 100%
      );
    `,
    headerZone: css`
      flex: none;
      padding-block-end: 2px;
    `,
    identityCard: css`
      margin-block-start: 8px;
      margin-inline: 8px;
      padding-block: 6px;
      padding-inline: 8px;
      border: 1px solid ${cssVar.colorBorderSecondary};
      border-radius: ${cssVar.borderRadiusLG};

      background: ${cssVar.colorFillQuaternary};
    `,
    middleFooterZone: css`
      flex: none;
      padding-block: 6px 2px;
      padding-inline: 2px;
    `,
    sectionLabel: css`
      display: block;

      padding-block: 8px 4px;
      padding-inline: 10px;

      font-size: ${cssVar.fontSizeSM};
      font-weight: 600;
      line-height: 1.2;
      color: ${cssVar.colorTextSecondary};
      text-transform: none;
      letter-spacing: 0.02em;
    `,
    shell: css`
      display: flex;
      flex-direction: column;
      min-height: 0;
    `,
    /** Home sidebar accordion body — breathing room at scroll bottom */
    scrollAccordionBody: css`
      flex: 1;
      min-height: 0;
      padding-block-end: 6px;
    `,
  };
});
