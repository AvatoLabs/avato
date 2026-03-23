import { Flexbox, type NeutralColors, type PrimaryColors, Text } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { type CSSProperties, memo } from 'react';
import { useTranslation } from 'react-i18next';

import { getThemePresetPreview, THEME_PRESETS, type ThemePresetId } from './themePresets';

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    cursor: pointer;

    width: 100%;
    padding: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;

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
    }
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 188px), 1fr));
    flex: 1 1 100%;
    gap: 12px;

    width: 100%;
    min-width: 0;
  `,
  preview: css`
    position: relative;

    overflow: hidden;

    height: 88px;
    margin-block-end: 10px;
    padding: 10px;
    border: 1px solid color-mix(in srgb, var(--preset-neutral) 14%, transparent);
    border-radius: 14px;

    background:
      radial-gradient(
        circle at top right,
        color-mix(in srgb, var(--preset-accent) 18%, transparent) 0,
        transparent 42%
      ),
      linear-gradient(
        155deg,
        color-mix(in srgb, var(--preset-neutral) 8%, #fff) 0%,
        color-mix(in srgb, var(--preset-neutral) 18%, #f5f6f8) 100%
      );
  `,
  previewBubble: css`
    gap: 4px;
    align-self: flex-end;

    width: 54px;
    padding: 7px;
    border-radius: 12px 12px 4px;

    background: color-mix(in srgb, var(--preset-accent) 18%, #fff);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--preset-accent) 14%, transparent);
  `,
  previewFrame: css`
    overflow: hidden;
    flex: 1;

    border: 1px solid color-mix(in srgb, var(--preset-neutral) 16%, transparent);
    border-radius: 12px;

    background: color-mix(in srgb, var(--preset-neutral) 4%, #fff);
    box-shadow: 0 10px 24px -20px color-mix(in srgb, var(--preset-neutral) 28%, transparent);
  `,
  previewHeader: css`
    display: flex;
    gap: 6px;
    align-items: center;

    padding-block: 7px;
    padding-inline: 8px;
    border-block-end: 1px solid color-mix(in srgb, var(--preset-neutral) 12%, transparent);
  `,
  previewInput: css`
    width: 34px;
    height: 8px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--preset-accent) 55%, #fff);
  `,
  previewLine: css`
    height: 5px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--preset-neutral) 46%, transparent);
  `,
  previewSidebar: css`
    gap: 6px;
    width: 18px;
    padding-block-start: 2px;
  `,
  selected: css`
    border-color: ${cssVar.colorPrimary};
    box-shadow: 0 0 0 1px ${cssVar.colorPrimaryBorderHover};
  `,
  title: css`
    font-weight: 600;
  `,
}));

interface ThemePresetSelectProps {
  customPreview?: {
    neutralColor?: NeutralColors;
    primaryColor?: PrimaryColors;
  };
  onChange: (id: ThemePresetId) => void;
  value: ThemePresetId;
}

const ThemePresetSelect = memo<ThemePresetSelectProps>(({ customPreview, value, onChange }) => {
  const { t } = useTranslation('setting');

  return (
    <div className={styles.grid}>
      {THEME_PRESETS.map((preset) => {
        const preview = getThemePresetPreview(preset.id, customPreview);
        const previewStyle = {
          '--preset-accent': preview.accent,
          '--preset-neutral': preview.neutral,
        } as CSSProperties;

        return (
          <button
            aria-pressed={value === preset.id}
            className={cx(styles.card, value === preset.id && styles.selected)}
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
          >
            <div className={styles.preview} style={previewStyle}>
              <Flexbox horizontal gap={10} height={'100%'}>
                <Flexbox className={styles.previewSidebar}>
                  <div
                    style={{
                      background: preview.accent,
                      borderRadius: 999,
                      height: 8,
                      width: 8,
                    }}
                  />
                  <div className={styles.previewLine} style={{ width: 14 }} />
                  <div className={styles.previewLine} style={{ width: 10 }} />
                  <div className={styles.previewLine} style={{ width: 12 }} />
                </Flexbox>
                <Flexbox className={styles.previewFrame}>
                  <div className={styles.previewHeader}>
                    <div
                      style={{
                        background: 'color-mix(in srgb, var(--preset-accent) 16%, #fff)',
                        borderRadius: 999,
                        height: 10,
                        width: 10,
                      }}
                    />
                    <div className={styles.previewLine} style={{ width: 28 }} />
                  </div>
                  <Flexbox flex={1} gap={8} padding={8}>
                    <Flexbox className={styles.previewBubble}>
                      <div className={styles.previewLine} style={{ width: '100%' }} />
                      <div className={styles.previewLine} style={{ width: '70%' }} />
                    </Flexbox>
                    <div className={styles.previewInput} />
                  </Flexbox>
                </Flexbox>
              </Flexbox>
            </div>
            <Flexbox gap={2}>
              <Text as={'div'} className={styles.title} fontSize={14}>
                {t(`settingAppearance.themePreset.options.${preset.id}.title`)}
              </Text>
              <Text as={'div'} fontSize={12} type={'secondary'}>
                {t(`settingAppearance.themePreset.options.${preset.id}.desc`)}
              </Text>
            </Flexbox>
          </button>
        );
      })}
    </div>
  );
});

export default ThemePresetSelect;
