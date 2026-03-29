'use client';

import {
  Block,
  Flexbox,
  type NeutralColors,
  type PrimaryColors,
  Text,
  ThemeProvider,
} from '@lobehub/ui';
import { createStaticStyles, type CustomTokenParams, useTheme } from 'antd-style';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { getChatgptDarkSurfaceTokenOverrides } from '@/const/chatgptDarkSurfaces';
import { resolveSolidTextColor } from '@/layout/GlobalProvider/themeShared';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

const styles = createStaticStyles(({ css, cssVar }) => ({
  accentBubble: css`
    padding-block: 10px;
    padding-inline: 12px;
    border-radius: 16px 16px 8px;
    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 54%, ${cssVar.colorPrimary} 46%);
  `,
  assistantBubble: css`
    padding-block: 10px;
    padding-inline: 12px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
    border-radius: 16px 16px 16px 8px;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorFillSecondary} 8%);
  `,
  bubbleLine: css`
    height: 3px;
    border-radius: 999px;
    background: ${cssVar.colorTextQuaternary};
  `,
  composer: css`
    padding: 10px;
    border-block-start: 1px solid
      color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
    background: color-mix(in srgb, ${cssVar.colorBgContainer} 98%, ${cssVar.colorFillSecondary} 2%);
  `,
  composerField: css`
    padding-block: 10px;
    padding-inline: 12px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
    border-radius: 16px;

    background: ${cssVar.colorBgContainer};
  `,
  container: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    width: 100%;

    @media (width <= 900px) {
      grid-template-columns: 1fr;
    }
  `,
  controlDot: css`
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: ${cssVar.colorFillSecondary};
  `,
  currentSession: css`
    padding: 8px;
    border-radius: 14px;
    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 18%, ${cssVar.colorBgContainer});
  `,
  header: css`
    padding: 10px;
    border-block-end: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
  `,
  iconTile: css`
    border-radius: 10px;
    background: ${cssVar.colorFillSecondary};
  `,
  sceneCard: css`
    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 20px;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 96%, ${cssVar.colorFillSecondary} 4%);
    box-shadow: ${cssVar.boxShadowTertiary};
  `,
  sceneLabel: css`
    font-size: 12px;
    font-weight: 600;
    line-height: 1.4;
    color: ${cssVar.colorTextSecondary};
  `,
  sceneMeta: css`
    font-size: 11px;
    color: ${cssVar.colorTextDescription};
  `,
  sidebar: css`
    padding: 8px;
    border-inline-end: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
    background: color-mix(in srgb, ${cssVar.colorBgLayout} 88%, ${cssVar.colorBgContainer} 12%);
  `,
  surface: css`
    overflow: hidden;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 18px;
    background: ${cssVar.colorBgLayout};
  `,
  topNav: css`
    width: 28px;
    padding-block: 8px;
    padding-inline: 6px;
    border-inline-end: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);

    background: color-mix(in srgb, ${cssVar.colorBgLayout} 92%, ${cssVar.colorBgContainer} 8%);
  `,
  window: css`
    display: grid;
    grid-template-columns: 28px 88px minmax(0, 1fr);
    height: 220px;
  `,
}));

const SceneCanvas = memo<{ scheme: 'dark' | 'light'; title: string }>(({ scheme, title }) => {
  const { t } = useTranslation('setting');
  const theme = useTheme();

  return (
    <Block className={styles.sceneCard} variant={'outlined'}>
      <Flexbox gap={12}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Text as={'div'} className={styles.sceneLabel}>
            {title}
          </Text>
          <Text as={'div'} className={styles.sceneMeta}>
            {scheme === 'dark'
              ? t('settingCommon.themeMode.dark')
              : t('settingCommon.themeMode.light')}
          </Text>
        </Flexbox>
        <div className={styles.surface}>
          <div className={styles.window}>
            <Flexbox align={'center'} className={styles.topNav} gap={8}>
              <div
                className={styles.iconTile}
                style={{
                  background: theme.colorPrimary,
                  borderRadius: '50%',
                  height: 14,
                  width: 14,
                }}
              />
              <div className={styles.controlDot} />
              <div className={styles.controlDot} />
              <div className={styles.controlDot} />
            </Flexbox>
            <Flexbox className={styles.sidebar} gap={8}>
              <Flexbox gap={4}>
                <div className={styles.bubbleLine} style={{ width: '56%' }} />
                <div className={styles.bubbleLine} style={{ opacity: 0.72, width: '92%' }} />
              </Flexbox>
              <div className={styles.currentSession}>
                <Flexbox gap={5}>
                  <div className={styles.bubbleLine} style={{ width: '68%' }} />
                  <div className={styles.bubbleLine} style={{ opacity: 0.72, width: '92%' }} />
                </Flexbox>
              </div>
              <Flexbox gap={8}>
                <div className={styles.bubbleLine} style={{ width: '82%' }} />
                <div className={styles.bubbleLine} style={{ width: '74%' }} />
                <div className={styles.bubbleLine} style={{ opacity: 0.72, width: '88%' }} />
              </Flexbox>
            </Flexbox>
            <Flexbox flex={1}>
              <Flexbox className={styles.header} gap={8}>
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <Flexbox horizontal align={'center'} gap={8}>
                    <div
                      className={styles.iconTile}
                      style={{ borderRadius: '50%', height: 16, width: 16 }}
                    />
                    <div className={styles.bubbleLine} style={{ width: 88 }} />
                  </Flexbox>
                  <Flexbox horizontal gap={6}>
                    <div className={styles.iconTile} style={{ height: 12, width: 12 }} />
                    <div className={styles.iconTile} style={{ height: 12, width: 12 }} />
                  </Flexbox>
                </Flexbox>
                <Flexbox horizontal align={'center'} gap={6}>
                  <div
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: theme.colorPrimaryBg,
                      color: theme.colorPrimary,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Model
                  </div>
                  <div className={styles.bubbleLine} style={{ opacity: 0.72, width: 72 }} />
                </Flexbox>
              </Flexbox>
              <Flexbox flex={1} gap={10} padding={10}>
                <Flexbox horizontal align={'center'} gap={6}>
                  <div
                    className={styles.iconTile}
                    style={{ borderRadius: '50%', flex: 'none', height: 16, width: 16 }}
                  />
                  <div className={styles.assistantBubble}>
                    <Flexbox gap={5}>
                      <div className={styles.bubbleLine} style={{ width: 124 }} />
                      <div className={styles.bubbleLine} style={{ opacity: 0.8, width: 92 }} />
                      <div className={styles.bubbleLine} style={{ opacity: 0.64, width: 146 }} />
                    </Flexbox>
                  </div>
                </Flexbox>
                <Flexbox horizontal align={'center'} gap={6} justify={'flex-end'}>
                  <div className={styles.accentBubble}>
                    <Flexbox gap={5}>
                      <div
                        className={styles.bubbleLine}
                        style={{ background: theme.colorTextLightSolid, opacity: 0.84, width: 98 }}
                      />
                      <div
                        className={styles.bubbleLine}
                        style={{ background: theme.colorTextLightSolid, opacity: 0.68, width: 66 }}
                      />
                    </Flexbox>
                  </div>
                  <div
                    className={styles.iconTile}
                    style={{ borderRadius: '50%', flex: 'none', height: 16, width: 16 }}
                  />
                </Flexbox>
              </Flexbox>
              <div className={styles.composer}>
                <Flexbox horizontal align={'center'} gap={8}>
                  <div className={styles.composerField} style={{ flex: 1 }}>
                    <Flexbox gap={5}>
                      <div className={styles.bubbleLine} style={{ width: '62%' }} />
                      <div className={styles.bubbleLine} style={{ opacity: 0.66, width: '34%' }} />
                    </Flexbox>
                  </div>
                  <div
                    style={{
                      height: 28,
                      width: 42,
                      borderRadius: 14,
                      background: theme.colorPrimary,
                    }}
                  />
                </Flexbox>
              </div>
            </Flexbox>
          </div>
        </div>
      </Flexbox>
    </Block>
  );
});

SceneCanvas.displayName = 'AppearancePreviewScene';

const Preview = memo(() => {
  const [primaryColor, neutralColor] = useUserStore((s) => [
    userGeneralSettingsSelectors.primaryColor(s) as PrimaryColors | undefined,
    userGeneralSettingsSelectors.neutralColor(s) as NeutralColors | undefined,
  ]);
  const { t } = useTranslation('setting');

  const solidTextColor = useMemo(() => resolveSolidTextColor(primaryColor), [primaryColor]);

  const customToken = useCallback(
    ({ isDarkMode }: CustomTokenParams) =>
      getChatgptDarkSurfaceTokenOverrides(isDarkMode, solidTextColor),
    [solidTextColor],
  );

  const customTheme = useMemo(
    () => ({
      neutralColor,
      primaryColor,
    }),
    [neutralColor, primaryColor],
  );

  return (
    <div className={styles.container}>
      {(['light', 'dark'] as const).map((scheme) => (
        <ThemeProvider
          appearance={scheme}
          customTheme={customTheme}
          customToken={customToken}
          key={scheme}
          themeMode={scheme}
          theme={{
            cssVar: { key: `appearance-preview-${scheme}` },
            token: {
              colorTextLightSolid: solidTextColor,
            },
          }}
        >
          <SceneCanvas
            scheme={scheme}
            title={
              scheme === 'light'
                ? t('settingCommon.themeMode.light')
                : t('settingCommon.themeMode.dark')
            }
          />
        </ThemeProvider>
      ))}
    </div>
  );
});

export default Preview;
