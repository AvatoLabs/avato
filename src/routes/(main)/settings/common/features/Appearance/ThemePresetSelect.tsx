import { Text } from '@lobehub/ui';
import { createStaticStyles, cx, useThemeMode } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { getThemePresetPreview, THEME_PRESETS, type ThemePresetId } from './themePresets';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    cursor: pointer;

    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 6px;

    min-width: 72px;
    padding: 8px;
    border: 1.5px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;

    font: inherit;
    color: inherit;
    text-align: start;

    appearance: none;
    background: ${cssVar.colorBgContainer};

    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;

    &:hover {
      transform: translateY(-1px);
      border-color: ${cssVar.colorBorder};
      box-shadow: ${cssVar.boxShadowTertiary};
    }
  `,
  colorBar: css`
    overflow: hidden;
    display: flex;
    height: 12px;
    border-radius: 999px;
  `,
  colorBarAccent: css`
    flex: 1.5;
    height: 100%;
  `,
  colorBarNeutral: css`
    flex: 1;
    height: 100%;
    opacity: 0.7;
  `,
  grid: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    width: 100%;
  `,
  label: css`
    font-size: 11px;
    font-weight: 500;
    line-height: 1.4;
    color: ${cssVar.colorText};
  `,
  selected: css`
    border-color: ${cssVar.colorPrimary};
    box-shadow: 0 0 0 1px ${cssVar.colorPrimaryBorderHover};

    &:hover {
      border-color: ${cssVar.colorPrimary};
    }
  `,
}));

interface ThemePresetSelectProps {
  customPreview?: {
    neutralColor?: string;
    primaryColor?: string;
  };
  onChange: (id: ThemePresetId) => void;
  value: ThemePresetId;
}

const ThemePresetSelect = memo<ThemePresetSelectProps>(({ customPreview, value, onChange }) => {
  const { t } = useTranslation('setting');
  const { isDarkMode } = useThemeMode();

  return (
    <div className={styles.grid}>
      {THEME_PRESETS.map((preset) => {
        const presetPreview = getThemePresetPreview(
          preset.id,
          preset.id === 'custom' ? customPreview : undefined,
          isDarkMode ? 'dark' : 'light',
        );
        const isSelected = value === preset.id;

        return (
          <button
            aria-pressed={isSelected}
            className={cx(styles.card, isSelected && styles.selected)}
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
          >
            <div className={styles.colorBar}>
              <div className={styles.colorBarAccent} style={{ background: presetPreview.accent }} />
              <div
                className={styles.colorBarNeutral}
                style={{ background: presetPreview.neutral }}
              />
            </div>
            <Text ellipsis as="div" className={styles.label}>
              {t(`settingAppearance.themePreset.options.${preset.id}.title`)}
            </Text>
          </button>
        );
      })}
    </div>
  );
});

export default ThemePresetSelect;
