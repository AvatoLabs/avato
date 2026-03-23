'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import urlJoin from 'url-join';

import { ACTION_ENTRY_ICONS, APP_ENTRY_ICONS } from '@/config/entryIcons';
import NavItem from '@/features/NavPanel/components/NavItem';
import { useQueryRoute } from '@/hooks/useQueryRoute';
import { usePathname } from '@/libs/router/navigation';
import { useActionSWR } from '@/libs/swr';
import { useChatStore } from '@/store/chat';
import { useGlobalStore } from '@/store/global';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

const Nav = memo(() => {
  const { t } = useTranslation('chat');
  const { t: tTopic } = useTranslation('topic');
  const params = useParams();
  const agentId = params.aid;
  const pathname = usePathname();
  const isProfileActive = pathname.includes('/profile');
  const isIntegrationActive = pathname.includes('/channel');
  const router = useQueryRoute();
  const { isAgentEditable } = useServerConfigStore(featureFlagsSelectors);
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const isDevMode = useUserStore((s) => userGeneralSettingsSelectors.config(s).isDevMode);
  const hideProfile = !isAgentEditable;
  const switchTopic = useChatStore((s) => s.switchTopic);
  const [openNewTopicOrSaveTopic] = useChatStore((s) => [s.openNewTopicOrSaveTopic]);

  const { mutate } = useActionSWR('openNewTopicOrSaveTopic', openNewTopicOrSaveTopic);
  const handleNewTopic = () => {
    // If in agent sub-route, navigate back to agent chat first
    if (isProfileActive && agentId) {
      router.push(urlJoin('/agent', agentId));
    }
    mutate();
  };

  return (
    <Flexbox gap={1} paddingInline={4}>
      <NavItem
        icon={ACTION_ENTRY_ICONS.newTopic}
        title={tTopic('actions.addNewTopic')}
        onClick={handleNewTopic}
      />
      {!hideProfile && (
        <NavItem
          active={isProfileActive}
          icon={ACTION_ENTRY_ICONS.profile}
          title={t('tab.profile')}
          onClick={() => {
            switchTopic(null, { skipRefreshMessage: true });
            router.push(urlJoin('/agent', agentId!, 'profile'));
          }}
        />
      )}
      {!hideProfile && isDevMode && (
        <NavItem
          active={isIntegrationActive}
          icon={ACTION_ENTRY_ICONS.integration}
          title={t('tab.integration')}
          onClick={() => {
            switchTopic(null, { skipRefreshMessage: true });
            router.push(urlJoin('/agent', agentId!, 'channel'));
          }}
        />
      )}
      <NavItem
        icon={APP_ENTRY_ICONS.search}
        title={t('tab.search')}
        onClick={() => {
          toggleCommandMenu(true);
        }}
      />
    </Flexbox>
  );
});

export default Nav;
