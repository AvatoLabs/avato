import { LOBE_CHAT_CLOUD, UTM_SOURCE } from '@lobechat/business-const';
import { OFFICIAL_URL } from '@lobechat/const';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type CellProps } from '@/components/Cell';
import { APP_ENTRY_ICONS, SETTINGS_ENTRY_ICONS } from '@/config/entryIcons';
import { DOCUMENTS, FEEDBACK } from '@/const/index';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

export const useCategory = (onOpenChangelogModal: () => void) => {
  const navigate = useNavigate();
  const { t } = useTranslation(['common', 'setting', 'auth']);
  const { showCloudPromotion, hideDocs } = useServerConfigStore(featureFlagsSelectors);
  const [isLoginWithAuth] = useUserStore((s) => [authSelectors.isLoginWithAuth(s)]);

  const profile: CellProps[] = [
    {
      icon: SETTINGS_ENTRY_ICONS.profile,
      key: 'profile',
      label: t('userPanel.profile'),
      onClick: () => navigate('/me/profile'),
    },
  ];

  const settings: CellProps[] = [
    {
      icon: APP_ENTRY_ICONS.settings,
      key: 'setting',
      label: t('userPanel.setting'),
      onClick: () => navigate('/me/settings'),
    },
    {
      type: 'divider',
    },
  ];

  /* ↓ cloud slot ↓ */
  const helps: CellProps[] = [
    showCloudPromotion && {
      icon: SETTINGS_ENTRY_ICONS.cloud,
      key: 'cloud',
      label: t('userPanel.cloud', { name: LOBE_CHAT_CLOUD }),
      onClick: () => window.open(`${OFFICIAL_URL}?utm_source=${UTM_SOURCE}`, '__blank'),
    },
    {
      icon: SETTINGS_ENTRY_ICONS.docs,
      key: 'docs',
      label: t('document'),
      onClick: () => window.open(DOCUMENTS, '__blank'),
    },
    {
      icon: SETTINGS_ENTRY_ICONS.feedback,
      key: 'feedback',
      label: t('feedback'),
      onClick: () => window.open(FEEDBACK, '__blank'),
    },
    {
      icon: SETTINGS_ENTRY_ICONS.changelog,
      key: 'changelog',
      label: t('changelog'),
      onClick: onOpenChangelogModal,
    },
  ].filter(Boolean) as CellProps[];

  const mainItems = [
    {
      type: 'divider',
    },
    ...(isLoginWithAuth ? profile : []),
    ...(isLoginWithAuth ? settings : []),
    /* ↓ cloud slot ↓ */

    /* ↑ cloud slot ↑ */
    ...(!hideDocs ? helps : []),
  ].filter(Boolean) as CellProps[];

  return mainItems;
};
