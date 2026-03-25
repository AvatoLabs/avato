import { Drawer, Flexbox, Icon, type NeutralColors, type PrimaryColors, Text } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { type CSSProperties, memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SETTINGS_ENTRY_ICONS } from '@/config/entryIcons';

import {
  getThemePreset,
  getThemePresetPreview,
  THEME_PRESETS,
  type ThemePresetId,
} from './themePresets';
import { ThemeSwatchesNeutral, ThemeSwatchesPrimary } from './ThemeSwatches';

const styles = createStaticStyles(({ css, cssVar }) => ({
  body: css`
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
  `,
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
  chip: css`
    display: inline-flex;
    gap: 8px;
    align-items: center;

    padding-block: 6px;
    padding-inline: 10px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    font-size: ${cssVar.fontSizeSM};
    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorBgContainer};
  `,
  chipDot: css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
  `,
  drawerHero: css`
    overflow: hidden;

    padding: 18px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 24px;

    background:
      radial-gradient(
        circle at top right,
        color-mix(in srgb, var(--preset-accent) 42%, transparent) 0,
        transparent 46%
      ),
      linear-gradient(
        160deg,
        color-mix(in srgb, var(--preset-neutral) 8%, ${cssVar.colorBgElevated}) 0%,
        color-mix(in srgb, var(--preset-neutral) 14%, ${cssVar.colorBgContainer}) 100%
      );
  `,
  drawerTitle: css`
    font-size: 18px;
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 188px), 1fr));
    flex: 1 1 100%;
    gap: 12px;

    width: 100%;
    min-width: 0;
  `,
  previewLarge: css`
    height: 112px;
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
        color-mix(in srgb, var(--preset-accent) 44%, transparent) 0,
        transparent 44%
      ),
      linear-gradient(
        155deg,
        color-mix(in srgb, var(--preset-neutral) 8%, #fff) 0%,
        color-mix(in srgb, var(--preset-neutral) 18%, #f5f6f8) 100%
      );
  `,
  /** 模拟主色实心按钮：纯色重点色 + 浅色纹理（对应白字层次） */
  previewBubble: css`
    gap: 4px;
    align-self: flex-end;

    width: 54px;
    padding: 7px;
    border-radius: 12px 12px 4px;

    background: var(--preset-accent);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--preset-accent) 35%, #000);
  `,
  previewBubbleLine: css`
    height: 5px;
    border-radius: 999px;
    background: rgb(255 255 255 / 72%);
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
    background: color-mix(in srgb, var(--preset-accent) 88%, #fff);
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
  section: css`
    display: flex;
    flex-direction: column;
    gap: 12px;
  `,
  sectionDescription: css`
    font-size: ${cssVar.fontSizeSM};
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  sectionDivider: css`
    height: 1px;
    background: ${cssVar.colorBorderSecondary};
  `,
  sectionTitle: css`
    font-size: ${cssVar.fontSize};
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
  selected: css`
    border-color: ${cssVar.colorPrimary};
    box-shadow: 0 0 0 1px ${cssVar.colorPrimaryBorderHover};
  `,
  title: css`
    font-weight: 600;
  `,
  trigger: css`
    cursor: pointer;

    display: grid;
    grid-template-columns: minmax(0, 156px) minmax(0, 1fr) auto;
    gap: 16px;
    align-items: center;

    width: 100%;
    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 20px;

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
  triggerAction: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 42px;
    height: 42px;
    border-radius: 14px;

    background: ${cssVar.colorFillQuaternary};
  `,
  triggerPreview: css`
    height: 96px;
    margin-block-end: 0;
  `,
  triggerSubtitle: css`
    font-size: ${cssVar.fontSizeSM};
    line-height: 1.5;
    color: ${cssVar.colorTextSecondary};
  `,
  triggerTitle: css`
    font-size: 16px;
    font-weight: 600;
    color: ${cssVar.colorText};
  `,
}));

interface ThemePresetSelectProps {
  customPreview?: {
    neutralColor?: NeutralColors;
    primaryColor?: PrimaryColors;
  };
  onChange: (id: ThemePresetId) => void;
  onNeutralChange?: (value?: NeutralColors) => void;
  onPrimaryChange?: (value?: PrimaryColors) => void;
  value: ThemePresetId;
}

const ThemePresetSelect = memo<ThemePresetSelectProps>(
  ({ customPreview, value, onChange, onPrimaryChange, onNeutralChange }) => {
    const { t } = useTranslation('setting');
    const [open, setOpen] = useState(false);
    const preview = useMemo(
      () => getThemePresetPreview(value, customPreview),
      [customPreview, value],
    );
    const currentPreset = getThemePreset(value);
    const isCustomPreset = value === 'custom';
    const previewStyle = {
      '--preset-accent': preview.accent,
      '--preset-neutral': preview.neutral,
    } as CSSProperties;

    const currentTitle = t(`settingAppearance.themePreset.options.${value}.title`);
    const currentDesc = t(`settingAppearance.themePreset.options.${value}.desc`);

    const renderPresetPreview = (presetPreview: typeof preview, className?: string) => {
      const style = {
        '--preset-accent': presetPreview.accent,
        '--preset-neutral': presetPreview.neutral,
      } as CSSProperties;

      return (
        <div className={cx(styles.preview, className)} style={style}>
          <Flexbox horizontal gap={10} height={'100%'}>
            <Flexbox className={styles.previewSidebar}>
              <div
                style={{
                  background: presetPreview.accent,
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
                    background: 'var(--preset-accent)',
                    borderRadius: 999,
                    height: 10,
                    width: 10,
                  }}
                />
                <div className={styles.previewLine} style={{ width: 28 }} />
              </div>
              <Flexbox flex={1} gap={8} padding={8}>
                <Flexbox className={styles.previewBubble}>
                  <div className={styles.previewBubbleLine} style={{ width: '100%' }} />
                  <div className={styles.previewBubbleLine} style={{ width: '70%' }} />
                </Flexbox>
                <div className={styles.previewInput} />
              </Flexbox>
            </Flexbox>
          </Flexbox>
        </div>
      );
    };

    return (
      <>
        <button className={styles.trigger} type="button" onClick={() => setOpen(true)}>
          {renderPresetPreview(preview, styles.triggerPreview)}
          <Flexbox gap={10} style={{ minWidth: 0 }}>
            <Flexbox gap={4}>
              <Text as={'div'} className={styles.sectionDescription}>
                {t('settingAppearance.themePreset.title')}
              </Text>
              <Text ellipsis as={'div'} className={styles.triggerTitle}>
                {currentTitle}
              </Text>
              <Text as={'div'} className={styles.triggerSubtitle} ellipsis={{ rows: 2 }}>
                {currentDesc}
              </Text>
            </Flexbox>
            <Flexbox horizontal gap={8} wrap={'wrap'}>
              <div className={styles.chip}>
                <span className={styles.chipDot} style={{ background: preview.accent }} />
                {t('settingAppearance.primaryColor.title')}
              </div>
              <div className={styles.chip}>
                <span className={styles.chipDot} style={{ background: preview.neutral }} />
                {t('settingAppearance.neutralColor.title')}
              </div>
            </Flexbox>
          </Flexbox>
          <div className={styles.triggerAction}>
            <Icon icon={SETTINGS_ENTRY_ICONS.common} size={16} />
          </div>
        </button>

        <Drawer
          destroyOnHidden
          open={open}
          placement={'right'}
          title={t('settingAppearance.themePreset.title')}
          width={720}
          styles={{
            body: { padding: 0 },
          }}
          onClose={() => setOpen(false)}
        >
          <div className={styles.body}>
            <div className={styles.drawerHero} style={previewStyle}>
              <Flexbox gap={16}>
                {renderPresetPreview(preview, styles.previewLarge)}
                <Flexbox gap={4}>
                  <Text as={'div'} className={styles.sectionDescription}>
                    {currentPreset?.id === 'custom'
                      ? t('settingAppearance.themePreset.options.custom.title')
                      : t('settingAppearance.themePreset.title')}
                  </Text>
                  <Text as={'div'} className={styles.drawerTitle}>
                    {currentTitle}
                  </Text>
                  <Text as={'div'} className={styles.sectionDescription}>
                    {currentDesc}
                  </Text>
                </Flexbox>
              </Flexbox>
            </div>

            <div className={styles.section}>
              <Text as={'div'} className={styles.sectionTitle}>
                {t('settingAppearance.themePreset.title')}
              </Text>
              <div className={styles.grid}>
                {THEME_PRESETS.map((preset) => {
                  const presetPreview = getThemePresetPreview(preset.id, customPreview);

                  return (
                    <button
                      aria-pressed={value === preset.id}
                      className={cx(styles.card, value === preset.id && styles.selected)}
                      key={preset.id}
                      type="button"
                      onClick={() => onChange(preset.id)}
                    >
                      {renderPresetPreview(presetPreview)}
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
            </div>

            <div className={styles.sectionDivider} />

            <div className={styles.section}>
              <Text as={'div'} className={styles.sectionTitle}>
                {t('settingAppearance.primaryColor.title')}
              </Text>
              <Text as={'div'} className={styles.sectionDescription}>
                {t(
                  isCustomPreset
                    ? 'settingAppearance.primaryColor.desc'
                    : 'settingAppearance.primaryColor.lockedDesc',
                )}
              </Text>
              <ThemeSwatchesPrimary
                disabled={!isCustomPreset}
                value={customPreview?.primaryColor}
                onChange={onPrimaryChange}
              />
            </div>

            <div className={styles.section}>
              <Text as={'div'} className={styles.sectionTitle}>
                {t('settingAppearance.neutralColor.title')}
              </Text>
              <Text as={'div'} className={styles.sectionDescription}>
                {t(
                  isCustomPreset
                    ? 'settingAppearance.neutralColor.desc'
                    : 'settingAppearance.neutralColor.lockedDesc',
                )}
              </Text>
              <ThemeSwatchesNeutral
                disabled={!isCustomPreset}
                value={customPreview?.neutralColor}
                onChange={onNeutralChange}
              />
            </div>
          </div>
        </Drawer>
      </>
    );
  },
);

export default ThemePresetSelect;
