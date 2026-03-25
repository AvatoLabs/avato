import type { AliasToken } from 'antd/es/theme/interface';
import { mix } from 'polished';

/**
 * ChatGPT web dark mode surface palette (reference).
 * - layout: left rail / page shell
 * - container: main canvas
 * - elevated: inputs, pills, raised controls
 */
export const CHATGPT_DARK_SURFACE = {
  container: '#212121',
  elevated: '#2f2f2f',
  layout: '#171717',
} as const;

/** Maps ChatGPT-like neutrals onto antd semantic tokens (dark mode only). */
export function getChatgptDarkSurfaceTokenOverrides(
  isDarkMode: boolean,
): Partial<AliasToken> & { colorBgContainerSecondary?: string } {
  if (!isDarkMode) return {};

  const { layout, container, elevated } = CHATGPT_DARK_SURFACE;

  return {
    /**
     * 仅作用于 antd-style 的 customToken（useTheme/cssVar）；antd 组件以 ConfigProvider 为准，须同时在
     * `AppTheme` / `AuthThemeLite` 的 `theme.token` 中设置；另见 `src/styles/antdOverride.ts` 全局兜底。
     */
    colorTextLightSolid: '#ffffff',
    colorBgContainer: container,
    colorBgElevated: elevated,
    colorBgLayout: layout,
    colorBgContainerSecondary: mix(0.5, layout, container),
    // polished `mix(w, c1, c2)`: w=0 → c2, w=1 → c1. Small w with (elevated, #fff) was ~88% white.
    // Put #fff first so small w lifts the dark base instead of washing it out.
    colorFillQuaternary: mix(0.1, '#ffffff', layout),
    colorFillSecondary: mix(0.12, '#ffffff', elevated),
    colorFillTertiary: elevated,
  };
}
