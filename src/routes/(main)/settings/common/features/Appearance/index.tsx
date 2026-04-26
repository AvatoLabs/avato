'use client';

import { type FormGroupItemType, type NeutralColors, type PrimaryColors } from '@lobehub/ui';
import { Form, Icon, Skeleton } from '@lobehub/ui';
import { App, Segmented } from 'antd';
import isEqual from 'fast-deep-equal';
import { Ban, Gauge, Loader2Icon, Mouse, Waves } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FORM_STYLE } from '@/const/layoutTokens';
import { useUserStore } from '@/store/user';
import { settingsSelectors } from '@/store/user/slices/settings/selectors';
import { type UserGeneralConfig } from '@/types/user/settings';

import Preview from './Preview';
import {
  getThemePreset,
  normalizeThemeColor,
  resolveThemePreset,
  serializeThemeColor,
  type ThemePresetId,
} from './themePresets';
import ThemePresetSelect from './ThemePresetSelect';
import { ThemeSwatchesNeutral, ThemeSwatchesPrimary } from './ThemeSwatches';

const Appearance = memo(() => {
  const { t } = useTranslation('setting');
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { general } = useUserStore(settingsSelectors.currentSettings, isEqual);
  const [setSettings, isUserStateInit] = useUserStore((s) => [s.setSettings, s.isUserStateInit]);
  const [loading, setLoading] = useState(false);
  const [presetOverride, setPresetOverride] = useState<ThemePresetId | undefined>();

  const currentPrimaryColor = normalizeThemeColor(general.primaryColor);
  const currentNeutralColor = normalizeThemeColor(general.neutralColor);
  const resolvedPreset = resolveThemePreset(currentPrimaryColor, currentNeutralColor);
  const currentPreset = presetOverride ?? resolvedPreset;
  const isCustomPreset = currentPreset === 'custom';

  const updateTheme = useCallback(
    async (
      value: Pick<UserGeneralConfig, 'neutralColor' | 'primaryColor'>,
      options?: { showError?: boolean },
    ) => {
      setLoading(true);
      try {
        await setSettings({ general: value });
        return true;
      } catch (error) {
        console.error('Failed to save appearance settings:', error);
        if (options?.showError !== false) message.error(t('settingAppearance.saveFailed'));
        return false;
      } finally {
        setLoading(false);
      }
    },
    [message, setSettings, t],
  );

  const handlePresetChange = async (presetId: ThemePresetId) => {
    if (presetId === 'custom') {
      setPresetOverride('custom');
      return;
    }

    const preset = getThemePreset(presetId);
    if (!preset) return;

    setPresetOverride(undefined);
    await updateTheme({
      neutralColor: serializeThemeColor(preset.neutralColor) as any,
      primaryColor: serializeThemeColor(preset.primaryColor) as any,
    });
  };

  useEffect(() => {
    const preset = getThemePreset(resolvedPreset);

    if (!preset || preset.id === 'custom' || preset.id === 'obsidian') return;

    const legacyPrimaryColors =
      'legacyPrimaryColors' in preset ? preset.legacyPrimaryColors : undefined;
    const usesLegacyPrimaryColor = !!legacyPrimaryColors?.some(
      (value: string) => normalizeThemeColor(value) === currentPrimaryColor,
    );
    const usesPresetNeutralColor = normalizeThemeColor(preset.neutralColor) === currentNeutralColor;

    if (!usesLegacyPrimaryColor || !usesPresetNeutralColor) return;

    void updateTheme(
      {
        neutralColor: serializeThemeColor(preset.neutralColor) as any,
        primaryColor: serializeThemeColor(preset.primaryColor) as any,
      },
      { showError: false },
    );
  }, [currentNeutralColor, currentPrimaryColor, resolvedPreset, updateTheme]);

  if (!isUserStateInit) return <Skeleton active paragraph={{ rows: 5 }} title={false} />;

  const theme: FormGroupItemType = {
    children: [
      {
        children: (
          <ThemePresetSelect
            value={currentPreset}
            customPreview={{
              neutralColor: currentNeutralColor,
              primaryColor: currentPrimaryColor,
            }}
            onChange={(value) => void handlePresetChange(value)}
          />
        ),
        desc: t('settingAppearance.themePreset.desc'),
        label: t('settingAppearance.themePreset.title'),
        minWidth: undefined,
      },
      ...(isCustomPreset
        ? [
            {
              children: (
                <ThemeSwatchesPrimary
                  value={currentPrimaryColor as PrimaryColors | undefined}
                  onChange={(value) => {
                    const nextPresetOverride = currentPreset === 'custom' ? 'custom' : undefined;
                    setPresetOverride('custom');
                    void updateTheme({ primaryColor: serializeThemeColor(value) }).then((success) => {
                      if (!success) setPresetOverride(nextPresetOverride);
                    });
                  }}
                />
              ),
              desc: t('settingAppearance.primaryColor.desc'),
              label: t('settingAppearance.primaryColor.title'),
              minWidth: undefined,
            },
            {
              children: (
                <ThemeSwatchesNeutral
                  value={currentNeutralColor as NeutralColors | undefined}
                  onChange={(value) => {
                    const nextPresetOverride = currentPreset === 'custom' ? 'custom' : undefined;
                    setPresetOverride('custom');
                    void updateTheme({ neutralColor: serializeThemeColor(value) }).then((success) => {
                      if (!success) setPresetOverride(nextPresetOverride);
                    });
                  }}
                />
              ),
              desc: t('settingAppearance.neutralColor.desc'),
              label: t('settingAppearance.neutralColor.title'),
              minWidth: undefined,
            },
          ]
        : []),
      {
        children: <Preview />,
        label: t('settingAppearance.preview.title'),
        minWidth: undefined,
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
    ],
    extra: loading && <Icon spin icon={Loader2Icon} size={16} style={{ opacity: 0.5 }} />,
    title: t('settingAppearance.title'),
  };

  return (
    <Form
      collapsible={false}
      form={form}
      initialValues={general}
      items={[theme]}
      itemsType={'group'}
      variant={'filled'}
      onValuesChange={async (v) => {
        setLoading(true);
        try {
          await setSettings({ general: v });
        } catch (error) {
          console.error('Failed to save appearance settings:', error);
          form.setFieldsValue(general);
          message.error(t('settingAppearance.saveFailed'));
        } finally {
          setLoading(false);
        }
      }}
      {...FORM_STYLE}
      itemMinWidth={'100%'}
    />
  );
});

export default Appearance;
