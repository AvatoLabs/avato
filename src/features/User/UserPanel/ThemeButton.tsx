import { type ThemeMode } from '@lobechat/types';
import { type DropdownMenuProps } from '@lobehub/ui';
import { ActionIcon, Block, DropdownMenu, Icon, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { useTheme as useNextThemesTheme } from 'next-themes';
import { type FC } from 'react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { THEME_MODE_ICONS } from '@/config/entryIcons';
import { WORKSPACE_NAV_ROW_HEIGHT_PX } from '@/const/workspaceVisualTokens';
import { useUserStore } from '@/store/user';

const styles = createStaticStyles(({ css, cssVar }) => ({
  label: css`
    flex: 1;

    min-width: 0;

    font-size: ${cssVar.fontSize};
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
  trigger: css`
    border-radius: ${cssVar.borderRadiusSM};
    transition:
      background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      transform ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      background: ${cssVar.colorFillQuaternary};
    }

    &:active {
      transform: scale(0.99);
    }
  `,
  triggerIcon: css`
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;

    width: 30px;
    height: 30px;
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorFillQuaternary};
  `,
  value: css`
    flex: none;
    min-width: 0;
    font-size: ${cssVar.fontSizeSM};
    color: ${cssVar.colorTextSecondary};
  `,
}));

type ThemeButtonProps = {
  placement?: DropdownMenuProps['placement'];
  size?: number;
  variant?: 'icon' | 'sidebar';
};

const themeLabelKeyMap = {
  dark: 'settingCommon.themeMode.dark',
  light: 'settingCommon.themeMode.light',
  system: 'settingCommon.themeMode.auto',
} as const;

const ThemeButton: FC<ThemeButtonProps> = ({ placement, size, variant = 'icon' }) => {
  const { setTheme, theme } = useNextThemesTheme();
  const setSettings = useUserStore((s) => s.setSettings);
  const { t } = useTranslation('setting');
  const currentTheme = (theme as keyof typeof THEME_MODE_ICONS) || 'system';
  const currentThemeLabel = t(themeLabelKeyMap[currentTheme]);

  const applyThemeMode = useCallback(
    (mode: ThemeMode) => {
      setTheme(mode);
      // Persist after next-themes / DOM update so antd ThemeSwitcher doesn't race store vs resolved theme.
      queueMicrotask(() => {
        void setSettings({ general: { themeMode: mode } });
      });
    },
    [setSettings, setTheme],
  );

  const items = useMemo<DropdownMenuProps['items']>(
    () => [
      {
        icon: <Icon icon={THEME_MODE_ICONS.system} />,
        key: 'system',
        label: t('settingCommon.themeMode.auto'),
        onClick: () => applyThemeMode('system'),
      },
      {
        icon: <Icon icon={THEME_MODE_ICONS.light} />,
        key: 'light',
        label: t('settingCommon.themeMode.light'),
        onClick: () => applyThemeMode('light'),
      },
      {
        icon: <Icon icon={THEME_MODE_ICONS.dark} />,
        key: 'dark',
        label: t('settingCommon.themeMode.dark'),
        onClick: () => applyThemeMode('dark'),
      },
    ],
    [applyThemeMode, t],
  );

  if (variant === 'sidebar') {
    return (
      <DropdownMenu items={items} placement={placement}>
        <Block
          horizontal
          align={'center'}
          className={styles.trigger}
          gap={10}
          height={WORKSPACE_NAV_ROW_HEIGHT_PX}
          paddingInline={8}
          variant={'borderless'}
        >
          <div className={styles.triggerIcon}>
            <Icon color={'var(--ant-color-text)'} icon={THEME_MODE_ICONS[currentTheme]} size={16} />
          </div>
          <Text ellipsis className={styles.label}>
            {t('settingCommon.themeMode.title')}
          </Text>
          <Text ellipsis className={styles.value}>
            {currentThemeLabel}
          </Text>
        </Block>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu items={items} placement={placement}>
      <ActionIcon
        icon={THEME_MODE_ICONS[currentTheme]}
        size={size || { blockSize: 32, size: 16 }}
      />
    </DropdownMenu>
  );
};

export default ThemeButton;
