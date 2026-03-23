'use client';

import { type FormGroupItemType } from '@lobehub/ui';
import { Form, Icon, Skeleton } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { Loader2Icon } from 'lucide-react';
import { memo, useState } from 'react';
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
  const { general } = useUserStore(settingsSelectors.currentSettings, isEqual);
  const [setSettings, isUserStateInit] = useUserStore((s) => [s.setSettings, s.isUserStateInit]);
  const [loading, setLoading] = useState(false);
  const [presetOverride, setPresetOverride] = useState<ThemePresetId | undefined>();

  if (!isUserStateInit) return <Skeleton active paragraph={{ rows: 5 }} title={false} />;

  const currentPrimaryColor = normalizeThemeColor(general.primaryColor);
  const currentNeutralColor = normalizeThemeColor(general.neutralColor);
  const resolvedPreset = resolveThemePreset(currentPrimaryColor, currentNeutralColor);
  const currentPreset = presetOverride ?? resolvedPreset;
  const isCustomPreset = currentPreset === 'custom';

  const updateTheme = async (value: Pick<UserGeneralConfig, 'neutralColor' | 'primaryColor'>) => {
    setLoading(true);
    try {
      await setSettings({ general: value });
    } finally {
      setLoading(false);
    }
  };

  const handlePresetChange = async (presetId: ThemePresetId) => {
    if (presetId === 'custom') {
      setPresetOverride('custom');
      return;
    }

    const preset = getThemePreset(presetId);
    if (!preset) return;

    setPresetOverride(undefined);
    await updateTheme({
      neutralColor: serializeThemeColor(preset.neutralColor),
      primaryColor: serializeThemeColor(preset.primaryColor),
    });
  };

  const theme: FormGroupItemType = {
    children: [
      {
        children: <Preview />,
        label: t('settingAppearance.preview.title'),
        minWidth: undefined,
      },
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
      {
        children: (
          <ThemeSwatchesPrimary
            disabled={!isCustomPreset}
            value={currentPrimaryColor}
            onChange={(value) => {
              setPresetOverride('custom');
              void updateTheme({ primaryColor: serializeThemeColor(value) });
            }}
          />
        ),
        desc: t(
          isCustomPreset
            ? 'settingAppearance.primaryColor.desc'
            : 'settingAppearance.primaryColor.lockedDesc',
        ),
        label: t('settingAppearance.primaryColor.title'),
        minWidth: undefined,
      },
      {
        children: (
          <ThemeSwatchesNeutral
            disabled={!isCustomPreset}
            value={currentNeutralColor}
            onChange={(value) => {
              setPresetOverride('custom');
              void updateTheme({ neutralColor: serializeThemeColor(value) });
            }}
          />
        ),
        desc: t(
          isCustomPreset
            ? 'settingAppearance.neutralColor.desc'
            : 'settingAppearance.neutralColor.lockedDesc',
        ),
        label: t('settingAppearance.neutralColor.title'),
        minWidth: undefined,
      },
    ],
    extra: loading && <Icon spin icon={Loader2Icon} size={16} style={{ opacity: 0.5 }} />,
    title: t('settingAppearance.title'),
  };

  return (
    <Form
      collapsible={false}
      items={[theme]}
      itemsType={'group'}
      variant={'filled'}
      {...FORM_STYLE}
      itemMinWidth={'100%'}
    />
  );
});

export default Appearance;
