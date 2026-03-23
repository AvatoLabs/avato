'use client';

import { GROUP_CHAT_URL, SESSION_CHAT_URL } from '@lobechat/const';
import { type RecentTopic, type SidebarAgentItem } from '@lobechat/types';
import { Avatar, Block, Button, Flexbox, Tabs, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { BotMessageSquareIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import AgentGroupAvatar from '@/features/AgentGroupAvatar';
import GroupAvatar from '@/features/GroupAvatar';
import { useInitRecentPage } from '@/hooks/useInitRecentPage';
import { useInitRecentResource } from '@/hooks/useInitRecentResource';
import { useInitRecentTopic } from '@/hooks/useInitRecentTopic';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useHomeStore } from '@/store/home';
import { homeAgentListSelectors, homeRecentSelectors } from '@/store/home/selectors';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';

import CommunityAgents from './CommunityAgents';
import GroupSkeleton from './components/GroupSkeleton';
import Time from './components/Time';
import { RECENT_BLOCK_SIZE } from './const';
import InputArea from './InputArea';
import RecentPage from './RecentPage';
import RecentResource from './RecentResource';

const styles = createStaticStyles(({ css, cssVar }) => ({
  listItem: css`
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 12px;
    transition: all ${cssVar.motionDurationMid} ${cssVar.motionEaseInOut};

    &:hover {
      border-color: ${cssVar.colorPrimaryBorder};
      background: ${cssVar.colorFillQuaternary};
    }
  `,
}));

const getRecentTopicUrl = (topic: RecentTopic) =>
  topic.type === 'group' && topic.group
    ? `/group/${topic.group.id}?topic=${topic.id}`
    : `/agent/${topic?.agent?.id}?topic=${topic.id}`;

const renderTopicAvatar = (topic: RecentTopic) => {
  if (topic.type === 'group' && topic.group?.members?.length) {
    return (
      <GroupAvatar
        size={30}
        avatars={topic.group.members.map((member) => ({
          avatar: member.avatar || '🤖',
          backgroundColor: member.backgroundColor || undefined,
        }))}
      />
    );
  }

  return (
    <Avatar
      avatar={topic.agent?.avatar || '🤖'}
      background={topic.agent?.backgroundColor || undefined}
      shape={'square'}
      size={30}
    />
  );
};

const ResumeWorkPanel = memo<{ isRevalidating: boolean }>(({ isRevalidating }) => {
  const { t } = useTranslation(['home', 'chat']);
  const recentTopics = useHomeStore(homeRecentSelectors.recentTopics);
  const isRecentTopicsInit = useHomeStore(homeRecentSelectors.isRecentTopicsInit);

  const list = useMemo(() => recentTopics.slice(0, 6), [recentTopics]);

  return (
    <Block
      flex={1}
      padding={16}
      variant={'outlined'}
      style={{
        borderRadius: 16,
        minWidth: 0,
      }}
    >
      <Flexbox gap={12}>
        <Flexbox horizontal align={'center'} justify={'space-between'}>
          <Flexbox horizontal align={'center'} gap={8}>
            <BotMessageSquareIcon color={cssVar.colorTextSecondary} size={16} />
            <Text color={cssVar.colorTextSecondary} fontSize={14}>
              {t('workspace.resume.title')}
            </Text>
          </Flexbox>
          {isRevalidating && <Tag>{t('workspace.status.syncing')}</Tag>}
        </Flexbox>

        {!isRecentTopicsInit && (
          <GroupSkeleton
            height={RECENT_BLOCK_SIZE.TOPIC.HEIGHT}
            width={RECENT_BLOCK_SIZE.TOPIC.WIDTH}
          />
        )}

        {isRecentTopicsInit && list.length === 0 && (
          <Text fontSize={13} type={'secondary'}>
            {t('workspace.resume.empty')}
          </Text>
        )}

        {isRecentTopicsInit && list.length > 0 && (
          <Flexbox gap={8}>
            {list.map((topic) => {
              const agentOrGroup = topic.type === 'group' ? topic.group?.title : topic.agent?.title;
              const topicTitle = topic.title || t('workspace.resume.untitled');

              return (
                <Link
                  key={topic.id}
                  style={{ color: 'inherit', textDecoration: 'none' }}
                  to={getRecentTopicUrl(topic)}
                >
                  <Block clickable className={styles.listItem} padding={'10px 12px'}>
                    <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
                      <Flexbox horizontal align={'center'} gap={10} style={{ minWidth: 0 }}>
                        {renderTopicAvatar(topic)}
                        <Flexbox gap={4} style={{ minWidth: 0 }}>
                          <Text ellipsis={{ rows: 1 }} style={{ lineHeight: 1.3 }} weight={500}>
                            {topicTitle}
                          </Text>
                          <Flexbox horizontal align={'center'} gap={8} style={{ minWidth: 0 }}>
                            <Text ellipsis fontSize={12} type={'secondary'}>
                              {agentOrGroup || t('inbox.title', { ns: 'chat' })}
                            </Text>
                            <Time date={topic.updatedAt} />
                          </Flexbox>
                        </Flexbox>
                      </Flexbox>
                      <ChevronRightIcon color={cssVar.colorTextQuaternary} size={16} />
                    </Flexbox>
                  </Block>
                </Link>
              );
            })}
          </Flexbox>
        )}
      </Flexbox>
    </Block>
  );
});

const MyAssistantsPanel = memo(() => {
  const { t } = useTranslation(['home', 'chat']);
  const isLogin = useUserStore(authSelectors.isLogin);
  const useFetchAgentList = useHomeStore((s) => s.useFetchAgentList);
  const { isLoading } = useFetchAgentList(isLogin);
  const agents = useHomeStore(homeAgentListSelectors.allAgents);

  const list = useMemo(() => agents.slice(0, 10), [agents]);

  if (isLoading) {
    return (
      <GroupSkeleton
        height={RECENT_BLOCK_SIZE.AGENT.HEIGHT}
        width={RECENT_BLOCK_SIZE.AGENT.WIDTH}
      />
    );
  }

  if (list.length === 0) {
    return (
      <Text fontSize={13} type={'secondary'}>
        {t('workspace.assistants.empty')}
      </Text>
    );
  }

  const getAgentUrl = (item: SidebarAgentItem) =>
    item.type === 'group' ? GROUP_CHAT_URL(item.id) : SESSION_CHAT_URL(item.id, false);

  return (
    <Flexbox gap={8}>
      {list.map((item) => (
        <Link
          key={item.id}
          style={{ color: 'inherit', textDecoration: 'none' }}
          to={getAgentUrl(item)}
        >
          <Block clickable className={styles.listItem} padding={'10px 12px'}>
            <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
              <Flexbox horizontal align={'center'} gap={10} style={{ minWidth: 0 }}>
                {item.type === 'group' ? (
                  <AgentGroupAvatar
                    avatar={typeof item.avatar === 'string' ? item.avatar : undefined}
                    backgroundColor={item.backgroundColor || undefined}
                    memberAvatars={Array.isArray(item.avatar) ? item.avatar : []}
                    size={30}
                  />
                ) : (
                  <Avatar
                    avatar={typeof item.avatar === 'string' ? item.avatar : '🤖'}
                    background={item.backgroundColor || undefined}
                    shape={'square'}
                    size={30}
                  />
                )}
                <Flexbox gap={4} style={{ minWidth: 0 }}>
                  <Text ellipsis={{ rows: 1 }} style={{ lineHeight: 1.3 }} weight={500}>
                    {item.title ||
                      t(item.type === 'group' ? 'untitledGroup' : 'untitledAgent', { ns: 'chat' })}
                  </Text>
                  <Time date={item.updatedAt} />
                </Flexbox>
              </Flexbox>
              <ChevronRightIcon color={cssVar.colorTextQuaternary} size={16} />
            </Flexbox>
          </Block>
        </Link>
      ))}
    </Flexbox>
  );
});

const Home = memo(() => {
  const { t } = useTranslation(['home', 'file']);
  const isLogin = useUserStore(authSelectors.isLogin);
  const isMobile = useIsMobile();
  const inputActiveMode = useHomeStore((s) => s.inputActiveMode);

  useInitRecentPage();
  useInitRecentResource();
  const { isRevalidating: isTopicRevalidating } = useInitRecentTopic();

  const [activeTab, setActiveTab] = useState<'assistants' | 'community' | 'documents'>('documents');
  const [secondaryExpanded, setSecondaryExpanded] = useState(false);

  // De-emphasize heavy modules when a starter mode is active (user can still expand)
  const hideOtherModules = inputActiveMode && ['agent', 'group', 'write'].includes(inputActiveMode);

  useEffect(() => {
    if (!hideOtherModules) setSecondaryExpanded(false);
  }, [hideOtherModules]);

  const showSecondarySections = !hideOtherModules || secondaryExpanded;

  return (
    <Flexbox gap={24}>
      <Flexbox gap={6} style={{ marginTop: 8 }}>
        <Text style={{ fontSize: isMobile ? 28 : 34, lineHeight: 1.2 }} weight={700}>
          {t('workspace.hero.title')}
        </Text>
        <Text color={cssVar.colorTextSecondary} style={{ fontSize: isMobile ? 15 : 16 }}>
          {t('workspace.hero.subtitle')}
        </Text>
      </Flexbox>

      <InputArea />

      {hideOtherModules && !secondaryExpanded && (
        <Button
          block
          icon={<ChevronDownIcon size={16} />}
          style={{ borderColor: cssVar.colorBorderSecondary }}
          type={'default'}
          onClick={() => setSecondaryExpanded(true)}
        >
          {t('workspace.secondary.expand')}
        </Button>
      )}

      {showSecondarySections && (
        <Flexbox gap={16} width={'100%'}>
          {hideOtherModules && secondaryExpanded && (
            <Flexbox horizontal align={'center'} justify={'flex-end'} width={'100%'}>
              <Button type={'text'} onClick={() => setSecondaryExpanded(false)}>
                {t('workspace.secondary.collapse')}
              </Button>
            </Flexbox>
          )}

          <Flexbox gap={16} horizontal={!isMobile} width={'100%'}>
            {isLogin && <ResumeWorkPanel isRevalidating={isTopicRevalidating} />}
          </Flexbox>

          <Block
            padding={16}
            variant={'outlined'}
            style={{
              borderRadius: 16,
            }}
          >
            <Tabs
              activeKey={activeTab}
              items={[
                {
                  children: (
                    <Flexbox gap={24}>
                      {isLogin && <RecentPage />}
                      {isLogin && <RecentResource />}
                    </Flexbox>
                  ),
                  key: 'documents',
                  label: t('workspace.tabs.documents'),
                },
                {
                  children: <MyAssistantsPanel />,
                  key: 'assistants',
                  label: t('workspace.tabs.assistants'),
                },
                {
                  children: <CommunityAgents />,
                  key: 'community',
                  label: t('workspace.tabs.community'),
                },
              ]}
              onChange={(value) => setActiveTab(value as 'assistants' | 'community' | 'documents')}
            />
          </Block>
        </Flexbox>
      )}
    </Flexbox>
  );
});

export default Home;
