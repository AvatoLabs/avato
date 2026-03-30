'use client';

import { ActionIcon, DropdownMenu, type DropdownMenuProps, Icon } from '@avatohub/ui';
import { type ThemeMode } from '@lobechat/types';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme as useNextThemesTheme } from 'next-themes';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserStore } from '@/store/user';

const themeIcons = {
  dark: Moon,
  light: Sun,
  system: Monitor,
} as const;

const AuthThemeButton = memo<{ size?: number }>((props) => {
  const { setTheme, theme } = useNextThemesTheme();
  const setSettings = useUserStore((s) => s.setSettings);
  const { t } = useTranslation('setting');

  const applyThemeMode = useCallback(
    (mode: ThemeMode) => {
      setTheme(mode);
      queueMicrotask(() => {
        void setSettings({ general: { themeMode: mode } });
      });
    },
    [setSettings, setTheme],
  );

  const items = useMemo<DropdownMenuProps['items']>(
    () => [
      {
        icon: <Icon icon={themeIcons.system} />,
        key: 'system',
        label: t('settingCommon.themeMode.auto'),
        onClick: () => applyThemeMode('system'),
      },
      {
        icon: <Icon icon={themeIcons.light} />,
        key: 'light',
        label: t('settingCommon.themeMode.light'),
        onClick: () => applyThemeMode('light'),
      },
      {
        icon: <Icon icon={themeIcons.dark} />,
        key: 'dark',
        label: t('settingCommon.themeMode.dark'),
        onClick: () => applyThemeMode('dark'),
      },
    ],
    [applyThemeMode, t],
  );

  return (
    <DropdownMenu items={items}>
      <ActionIcon
        icon={themeIcons[(theme as 'dark' | 'light' | 'system') || 'system']}
        size={props.size || { blockSize: 32, size: 16 }}
      />
    </DropdownMenu>
  );
});

AuthThemeButton.displayName = 'AuthThemeButton';

export default AuthThemeButton;
