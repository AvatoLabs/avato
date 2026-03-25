'use client';

import { type ThemeMode } from '@lobechat/types';
import { type FormGroupItemType } from '@lobehub/ui';
import { Flexbox, Form, Icon, ImageSelect, Skeleton } from '@lobehub/ui';
import { Select, Switch } from '@lobehub/ui/base-ui';
import { message, Segmented } from 'antd';
import isEqual from 'fast-deep-equal';
import { Ban, Gauge, Loader2Icon, Monitor, Moon, Mouse, Sun, Waves } from 'lucide-react';
import { useTheme as useNextThemesTheme } from 'next-themes';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { imageUrl } from '@/const/url';
import { isDesktop } from '@/const/version';
import { localeOptions } from '@/locales/resources';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/selectors';
import { type LocaleMode } from '@/types/locale';

const Common = memo(() => {
  const { t } = useTranslation('setting');

  const general = useUserStore((s) => settingsSelectors.currentSettings(s).general, isEqual);
  const { theme, setTheme } = useNextThemesTheme();
  const language = useGlobalStore(systemStatusSelectors.language);
  const [setSettings, isUserStateInit] = useUserStore((s) => [s.setSettings, s.isUserStateInit]);
  const [switchLocale, isStatusInit] = useGlobalStore((s) => [s.switchLocale, s.isStatusInit]);
  const [loading, setLoading] = useState(false);

  const currentTheme: ThemeMode =
    (general?.themeMode as ThemeMode) || (theme as ThemeMode) || 'system';

  useEffect(() => {
    if (general?.themeMode && theme !== general.themeMode) {
      setTheme(general.themeMode);
    }
  }, [general?.themeMode, setTheme, theme]);

  const handleThemeChange = (value: string) => {
    const nextMode = (value === 'auto' ? 'system' : value) as ThemeMode;
    setTheme(nextMode);
    queueMicrotask(() => {
      void setSettings({ general: { themeMode: nextMode } });
    });
  };

  const handleLangChange = (value: LocaleMode) => {
    switchLocale(value);
  };

  if (!(isStatusInit && isUserStateInit))
    return <Skeleton active paragraph={{ rows: 5 }} title={false} />;

  const themeFormGroup: FormGroupItemType = {
    children: [
      {
        children: (
          <ImageSelect
            height={60}
            unoptimized={isDesktop}
            value={currentTheme}
            width={100}
            options={[
              {
                icon: Sun,
                img: imageUrl('theme_light.webp'),
                label: t('settingCommon.themeMode.light'),
                value: 'light',
              },
              {
                icon: Moon,
                img: imageUrl('theme_dark.webp'),
                label: t('settingCommon.themeMode.dark'),
                value: 'dark',
              },
              {
                icon: Monitor,
                img: imageUrl('theme_auto.webp'),
                label: t('settingCommon.themeMode.auto'),
                value: 'system',
              },
            ]}
            onChange={handleThemeChange}
          />
        ),
        desc: t('settingCommon.themeMode.desc'),
        label: t('settingCommon.themeMode.title'),
        minWidth: undefined,
      },
      {
        children: (
          <Flexbox horizontal justify={'flex-end'}>
            <Select
              value={language}
              options={[
                { label: t('settingCommon.lang.autoMode'), value: 'auto' },
                ...localeOptions,
              ]}
              style={{
                width: '50%',
              }}
              onChange={handleLangChange}
            />
          </Flexbox>
        ),
        label: t('settingCommon.lang.title'),
      },
      {
        children: (
          <Segmented
            options={[
              {
                icon: <Icon icon={Ban} size={16} />,
                label: t('settingAppearance.animationMode.disabled'),
                value: 'disabled',
              },
              {
                icon: <Icon icon={Gauge} size={16} />,
                label: t('settingAppearance.animationMode.agile'),
                value: 'agile',
              },
              {
                icon: <Icon icon={Waves} size={16} />,
                label: t('settingAppearance.animationMode.elegant'),
                value: 'elegant',
              },
            ]}
          />
        ),
        desc: t('settingAppearance.animationMode.desc'),
        label: t('settingAppearance.animationMode.title'),
        minWidth: undefined,
        name: 'animationMode',
      },
      {
        children: (
          <Segmented
            options={[
              {
                icon: <Icon icon={Ban} size={16} />,
                label: t('settingAppearance.contextMenuMode.disabled'),
                value: 'disabled',
              },
              {
                icon: <Icon icon={Mouse} size={16} />,
                label: t('settingAppearance.contextMenuMode.default'),
                value: 'default',
              },
            ]}
          />
        ),
        desc: t('settingAppearance.contextMenuMode.desc'),
        label: t('settingAppearance.contextMenuMode.title'),
        minWidth: undefined,
        name: 'contextMenuMode',
      },

      {
        children: (
          <Flexbox horizontal justify={'flex-end'}>
            <Select
              allowClear
              options={localeOptions}
              placeholder={t('settingCommon.responseLanguage.placeholder')}
              value={general?.responseLanguage || undefined}
              style={{
                width: '50%',
              }}
              onChange={(value) => {
                setSettings({ general: { responseLanguage: value ?? '' } });
              }}
            />
          </Flexbox>
        ),
        desc: t('settingCommon.responseLanguage.desc'),
        label: t('settingCommon.responseLanguage.title'),
      },
      {
        children: <Switch />,
        desc: t('settingCommon.liteMode.desc'),
        label: t('settingCommon.liteMode.title'),
        minWidth: undefined,
        name: 'isLiteMode',
        valuePropName: 'checked',
      },
    ],
    extra: loading && <Icon spin icon={Loader2Icon} size={16} style={{ opacity: 0.5 }} />,
    title: t('settingCommon.title'),
  };

  return (
    <Form
      collapsible={false}
      initialValues={general}
      items={[themeFormGroup]}
      itemsType={'group'}
      variant={'filled'}
      onValuesChange={async (v) => {
        setLoading(true);
        try {
          await setSettings({ general: v });
        } catch {
          message.error(t('settingCommon.saveFailed'));
        } finally {
          setLoading(false);
        }
      }}
      {...FORM_STYLE}
    />
  );
});

export default Common;
