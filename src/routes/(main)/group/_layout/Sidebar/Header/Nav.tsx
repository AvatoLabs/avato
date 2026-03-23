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
import { useAgentGroupStore } from '@/store/agentGroup';
import { useChatStore } from '@/store/chat';
import { useGlobalStore } from '@/store/global';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';

const Nav = memo(() => {
  const { t } = useTranslation('chat');
  const { t: tTopic } = useTranslation('topic');
  const params = useParams();
  const groupId = params.gid;
  const pathname = usePathname();
  const isProfileActive = pathname.includes('/profile');
  const router = useQueryRoute();
  const { isAgentEditable } = useServerConfigStore(featureFlagsSelectors);
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const switchTopic = useChatStore((s) => s.switchTopic);
  const switchToNewTopic = useAgentGroupStore((s) => s.switchToNewTopic);

  return (
    <Flexbox gap={1} paddingInline={4}>
      <NavItem
        icon={ACTION_ENTRY_ICONS.newTopic}
        title={tTopic('actions.addNewTopic')}
        onClick={switchToNewTopic}
      />
      {isAgentEditable && (
        <NavItem
          active={isProfileActive}
          icon={ACTION_ENTRY_ICONS.profile}
          title={t('tab.groupProfile')}
          onClick={() => {
            switchTopic(null, { skipRefreshMessage: true });
            router.push(urlJoin('/group', groupId!, 'profile'));
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
