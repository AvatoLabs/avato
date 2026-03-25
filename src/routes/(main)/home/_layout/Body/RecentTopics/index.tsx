'use client';

import { type RecentTopic } from '@lobechat/types';
import { AccordionItem, Avatar, Flexbox, Text } from '@lobehub/ui';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import GroupAvatar from '@/features/GroupAvatar';
import NavItem from '@/features/NavPanel/components/NavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { glassSidebarStyles } from '@/features/NavPanel/glassSidebar.styles';
import { useInitRecentTopic } from '@/hooks/useInitRecentTopic';
import { homeRecentSelectors, useHomeStore } from '@/store/home';

import Time from '../../../features/components/Time';

const getRecentTopicUrl = (topic: RecentTopic): string | null => {
  if (topic.type === 'group' && topic.group) {
    return `/group/${topic.group.id}?topic=${topic.id}`;
  }
  if (topic.agent?.id) {
    return `/agent/${topic.agent.id}?topic=${topic.id}`;
  }
  return null;
};

const RecentTopicRow = memo<{ topic: RecentTopic }>(({ topic }) => {
  const { t } = useTranslation('home');
  const url = useMemo(() => getRecentTopicUrl(topic), [topic]);
  const title = topic.title || t('workspace.sidebar.recentTopicUntitled');

  const icon =
    topic.type === 'group' && topic.group ? (
      topic.group.members?.length ? (
        <GroupAvatar
          size={24}
          avatars={topic.group.members.map((member) => ({
            avatar: member.avatar || '🤖',
            backgroundColor: member.backgroundColor || undefined,
          }))}
        />
      ) : (
        <Avatar avatar={'👥'} shape={'square'} size={24} />
      )
    ) : (
      <Avatar
        avatar={topic.agent?.avatar || '🤖'}
        background={topic.agent?.backgroundColor || undefined}
        shape={'square'}
        size={24}
      />
    );

  if (!url) return null;

  return (
    <Link style={{ color: 'inherit', textDecoration: 'none' }} to={url}>
      <NavItem extra={<Time date={topic.updatedAt} />} icon={icon} title={title} />
    </Link>
  );
});

RecentTopicRow.displayName = 'RecentTopicRow';

const RecentTopicsList = memo(() => {
  const { t } = useTranslation('home');
  const recentTopics = useHomeStore(homeRecentSelectors.recentTopics);
  const isInit = useHomeStore(homeRecentSelectors.isRecentTopicsInit);

  if (!isInit) {
    return <SkeletonList rows={5} />;
  }

  if (recentTopics.length === 0) {
    return (
      <Text
        fontSize={12}
        lineHeight={1.5}
        style={{ paddingBlock: 4, paddingInline: 8 }}
        type={'secondary'}
      >
        {t('workspace.sidebar.recentTopicsEmpty')}
      </Text>
    );
  }

  return (
    <Flexbox gap={4} paddingBlock={1}>
      {recentTopics.map((topic) => (
        <RecentTopicRow key={topic.id} topic={topic} />
      ))}
    </Flexbox>
  );
});

RecentTopicsList.displayName = 'RecentTopicsList';

interface RecentTopicsProps {
  itemKey: string;
}

const RecentTopics = memo<RecentTopicsProps>(({ itemKey }) => {
  const { t } = useTranslation('home');
  const { isRevalidating } = useInitRecentTopic();

  return (
    <AccordionItem
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline={'8px 4px'}
      title={
        <Flexbox horizontal align={'center'} gap={4}>
          <Text ellipsis className={glassSidebarStyles.groupHeader}>
            {t('workspace.sidebar.recentTopics')}
          </Text>
          {isRevalidating ? <NeuralNetworkLoading size={14} /> : null}
        </Flexbox>
      }
    >
      <RecentTopicsList />
    </AccordionItem>
  );
});

export default RecentTopics;
