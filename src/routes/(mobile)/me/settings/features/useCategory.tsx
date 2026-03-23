import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type CellProps } from '@/components/Cell';
import { SETTINGS_ENTRY_ICONS } from '@/config/entryIcons';
import { SettingsTabs } from '@/store/global/initialState';

export const useCategory = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('setting');

  const items: CellProps[] = [
    {
      icon: SETTINGS_ENTRY_ICONS.common,
      key: SettingsTabs.Common,
      label: t('tab.common'),
    },
    {
      icon: SETTINGS_ENTRY_ICONS.provider,
      key: SettingsTabs.Provider,
      label: t('tab.provider'),
    },
    {
      icon: SETTINGS_ENTRY_ICONS.agent,
      key: SettingsTabs.Agent,
      label: t('tab.agent'),
    },
    {
      icon: SETTINGS_ENTRY_ICONS.memory,
      key: SettingsTabs.Memory,
      label: t('tab.memory'),
    },
    { icon: SETTINGS_ENTRY_ICONS.tts, key: SettingsTabs.TTS, label: t('tab.tts') },
    {
      icon: SETTINGS_ENTRY_ICONS.about,
      key: SettingsTabs.About,
      label: t('tab.about'),
    },
  ].filter(Boolean) as CellProps[];

  return items.map((item) => ({
    ...item,
    onClick: () => {
      if (item.key === SettingsTabs.Provider) {
        navigate('/settings/provider/all');
      } else {
        navigate(`/settings/${item.key}`);
      }
    },
  }));
};
