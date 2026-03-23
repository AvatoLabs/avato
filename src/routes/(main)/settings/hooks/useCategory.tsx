import { isDesktop } from '@lobechat/const';
import { Avatar } from '@lobehub/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { SETTINGS_ENTRY_ICONS } from '@/config/entryIcons';
import { useElectronStore } from '@/store/electron';
import { electronSyncSelectors } from '@/store/electron/selectors';
import { SettingsTabs } from '@/store/global/initialState';
import {
  featureFlagsSelectors,
  serverConfigSelectors,
  useServerConfigStore,
} from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

export enum SettingsGroupKey {
  Account = 'account',
  AIConfig = 'ai-config',
  Profile = 'profile',
  Subscription = 'subscription',
  System = 'system',
}

export interface CategoryItem {
  icon: any;
  key: SettingsTabs;
  label: string;
}

export interface CategoryGroup {
  items: CategoryItem[];
  key: SettingsGroupKey;
  title: string;
}

export const useCategory = () => {
  const { t } = useTranslation('setting');
  const { t: tAuth } = useTranslation('auth');
  const { t: tSubscription } = useTranslation('subscription');
  const mobile = useServerConfigStore((s) => s.isMobile);
  const { enableSTT, hideDocs, showAiImage, showApiKeyManage } =
    useServerConfigStore(featureFlagsSelectors);
  const [avatar, username] = useUserStore((s) => [
    userProfileSelectors.userAvatar(s),
    userProfileSelectors.nickName(s),
  ]);
  const remoteServerUrl = useElectronStore(electronSyncSelectors.remoteServerUrl);

  // Process avatar URL for desktop environment
  const avatarUrl = useMemo(() => {
    if (!avatar) return undefined;
    if (isDesktop && avatar.startsWith('/') && remoteServerUrl) {
      return remoteServerUrl + avatar;
    }
    return avatar;
  }, [avatar, remoteServerUrl]);
  const enableBusinessFeatures = useServerConfigStore(serverConfigSelectors.enableBusinessFeatures);
  const categoryGroups: CategoryGroup[] = useMemo(() => {
    const groups: CategoryGroup[] = [];

    // Profile group - Profile-related settings
    const profileItems: CategoryItem[] = [
      {
        icon: avatarUrl ? (
          <Avatar avatar={avatarUrl} shape={'square'} size={26} />
        ) : (
          SETTINGS_ENTRY_ICONS.profile
        ),
        key: SettingsTabs.Profile,
        label: username ? username : tAuth('tab.profile'),
      },
      {
        icon: SETTINGS_ENTRY_ICONS.stats,
        key: SettingsTabs.Stats,
        label: tAuth('tab.stats'),
      },
      showApiKeyManage && {
        icon: SETTINGS_ENTRY_ICONS.apiKey,
        key: SettingsTabs.APIKey,
        label: tAuth('tab.apikey'),
      },
    ].filter(Boolean) as CategoryItem[];

    groups.push({
      items: profileItems,
      key: SettingsGroupKey.Profile,
      title: t('group.profile'),
    });

    if (enableBusinessFeatures) {
      const subscriptionItems: CategoryItem[] = [
        {
          icon: SETTINGS_ENTRY_ICONS.plans,
          key: SettingsTabs.Plans,
          label: tSubscription('tab.plans'),
        },
        {
          icon: SETTINGS_ENTRY_ICONS.funds,
          key: SettingsTabs.Funds,
          label: tSubscription('tab.funds'),
        },
        {
          icon: SETTINGS_ENTRY_ICONS.usage,
          key: SettingsTabs.Usage,
          label: tSubscription('tab.usage'),
        },
        {
          icon: SETTINGS_ENTRY_ICONS.billing,
          key: SettingsTabs.Billing,
          label: tSubscription('tab.billing'),
        },
        {
          icon: SETTINGS_ENTRY_ICONS.referral,
          key: SettingsTabs.Referral,
          label: tSubscription('tab.referral'),
        },
      ];

      groups.push({
        items: subscriptionItems,
        key: SettingsGroupKey.Subscription,
        title: t('group.subscription'),
      });
    }

    // Account group - personal settings
    const commonItems: CategoryItem[] = [
      {
        icon: SETTINGS_ENTRY_ICONS.common,
        key: SettingsTabs.Common,
        label: t('tab.common'),
      },
      {
        icon: SETTINGS_ENTRY_ICONS.chatAppearance,
        key: SettingsTabs.ChatAppearance,
        label: t('tab.chatAppearance'),
      },
      !mobile && {
        icon: SETTINGS_ENTRY_ICONS.hotkey,
        key: SettingsTabs.Hotkey,
        label: t('tab.hotkey'),
      },
    ].filter(Boolean) as CategoryItem[];

    groups.push({
      items: commonItems,
      key: SettingsGroupKey.Account,
      title: t('group.common'),
    });

    // AI configuration group - AI-related settings
    const aiConfigItems: CategoryItem[] = [
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
        icon: SETTINGS_ENTRY_ICONS.skill,
        key: SettingsTabs.Skill,
        label: t('tab.skill'),
      },
      isDesktop && {
        icon: SETTINGS_ENTRY_ICONS.mcpStudio,
        key: SettingsTabs.MCPStudio,
        label: t('tab.mcpStudio'),
      },
      {
        icon: SETTINGS_ENTRY_ICONS.memory,
        key: SettingsTabs.Memory,
        label: t('tab.memory'),
      },
      showAiImage && {
        icon: SETTINGS_ENTRY_ICONS.image,
        key: SettingsTabs.Image,
        label: t('tab.image'),
      },
      enableSTT && {
        icon: SETTINGS_ENTRY_ICONS.tts,
        key: SettingsTabs.TTS,
        label: t('tab.tts'),
      },
    ].filter(Boolean) as CategoryItem[];

    groups.push({
      items: aiConfigItems,
      key: SettingsGroupKey.AIConfig,
      title: t('group.aiConfig'),
    });

    // System group - system-related settings
    const systemItems: CategoryItem[] = [
      isDesktop && {
        icon: SETTINGS_ENTRY_ICONS.proxy,
        key: SettingsTabs.Proxy,
        label: t('tab.proxy'),
      },
      isDesktop && {
        icon: SETTINGS_ENTRY_ICONS.systemTools,
        key: SettingsTabs.SystemTools,
        label: t('tab.systemTools'),
      },
      isDesktop && {
        icon: SETTINGS_ENTRY_ICONS.beta,
        key: SettingsTabs.Beta,
        label: t('tab.beta'),
      },
      {
        icon: SETTINGS_ENTRY_ICONS.storage,
        key: SettingsTabs.Storage,
        label: t('tab.storage'),
      },
      {
        icon: SETTINGS_ENTRY_ICONS.advanced,
        key: SettingsTabs.Advanced,
        label: t('tab.advanced'),
      },
      !hideDocs && {
        icon: SETTINGS_ENTRY_ICONS.about,
        key: SettingsTabs.About,
        label: t('tab.about'),
      },
    ].filter(Boolean) as CategoryItem[];

    groups.push({
      items: systemItems,
      key: SettingsGroupKey.System,
      title: t('group.system'),
    });

    return groups;
  }, [
    t,
    tAuth,
    enableSTT,
    enableBusinessFeatures,
    hideDocs,
    isDesktop,
    mobile,
    showAiImage,
    showApiKeyManage,
    avatarUrl,
    username,
  ]);

  return categoryGroups;
};
