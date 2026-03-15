'use client';

import { GROUP_CHAT_URL, SESSION_CHAT_URL } from '@lobechat/const';
import { type RecentTopic, type SidebarAgentItem } from '@lobechat/types';
import { Avatar, Block, Button, Flexbox, Tabs, Tag, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import {
  BotMessageSquareIcon,
  ChevronRightIcon,
  CompassIcon,
  FileTextIcon,
  WrenchIcon,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import AgentGroupAvatar from '@/features/AgentGroupAvatar';
import GroupAvatar from '@/features/GroupAvatar';
import { useInitRecentPage } from '@/hooks/useInitRecentPage';
import { useInitRecentResource } from '@/hooks/useInitRecentResource';
import { useInitRecentTopic } from '@/hooks/useInitRecentTopic';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors, builtinAgentSelectors } from '@/store/agent/selectors';
import { useHomeStore } from '@/store/home';
import { homeAgentListSelectors, homeRecentSelectors } from '@/store/home/selectors';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';
import { FilesTabs } from '@/types/files';

import CommunityAgents from './CommunityAgents';
import GroupSkeleton from './components/GroupSkeleton';
import Time from './components/Time';
import { RECENT_BLOCK_SIZE } from './const';
import InputArea from './InputArea';
import RecentPage from './RecentPage';
import RecentResource from './RecentResource';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionButton: css`
    justify-content: flex-start;
  `,
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
  const [setInputActiveMode, navigate] = useHomeStore((s) => [s.setInputActiveMode, s.navigate]);
  const setCategory = useResourceManagerStore((s) => s.setCategory);
  const recentTopics = useHomeStore(homeRecentSelectors.recentTopics);
  const recentPages = useHomeStore(homeRecentSelectors.recentPages);

  useInitRecentPage();
  useInitRecentResource();
  const { isRevalidating: isTopicRevalidating } = useInitRecentTopic();

  const inboxAgentId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const model = useAgentStore((s) => agentByIdSelectors.getAgentModelById(inboxAgentId)(s));
  const provider = useAgentStore((s) =>
    agentByIdSelectors.getAgentModelProviderById(inboxAgentId)(s),
  );

  const isLobehubSkillEnabled = useServerConfigStore(serverConfigSelectors.enableLobehubSkill);
  const isKlavisEnabled = useServerConfigStore(serverConfigSelectors.enableKlavis);

  const [activeTab, setActiveTab] = useState<'assistants' | 'community' | 'documents'>('documents');

  // Hide heavy modules when a starter mode is active
  const hideOtherModules = inputActiveMode && ['agent', 'group', 'write'].includes(inputActiveMode);

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

      <Flexbox
        gap={16}
        horizontal={!isMobile}
        style={{ display: hideOtherModules ? 'none' : undefined }}
      >
        {isLogin && <ResumeWorkPanel isRevalidating={isTopicRevalidating} />}

        <Block
          flex={isMobile ? 1 : 'none'}
          padding={16}
          variant={'outlined'}
          style={{
            borderRadius: 16,
            minWidth: isMobile ? 'auto' : 320,
            width: isMobile ? '100%' : 320,
          }}
        >
          <Flexbox gap={16}>
            <Flexbox gap={8}>
              <Text color={cssVar.colorTextSecondary} fontSize={14}>
                {t('workspace.quickActions.title')}
              </Text>
              <Button
                className={styles.actionButton}
                icon={BotMessageSquareIcon}
                shape={'round'}
                variant={'outlined'}
                onClick={() => setInputActiveMode('agent')}
              >
                {t('starter.createAgent')}
              </Button>
              <Button
                className={styles.actionButton}
                icon={FileTextIcon}
                shape={'round'}
                variant={'outlined'}
                onClick={() => {
                  setCategory(FilesTabs.Pages);
                  navigate?.('/resource');
                }}
              >
                {t('workspace.quickActions.newDoc')}
              </Button>
              <Button
                className={styles.actionButton}
                icon={CompassIcon}
                shape={'round'}
                variant={'outlined'}
                onClick={() => navigate?.('/community/agent')}
              >
                {t('workspace.quickActions.openCommunity')}
              </Button>
            </Flexbox>

            <Flexbox gap={8}>
              <Text color={cssVar.colorTextSecondary} fontSize={14}>
                {t('workspace.status.title')}
              </Text>
              <Block
                padding={'8px 10px'}
                style={{ borderRadius: 10, background: cssVar.colorFillQuaternary }}
              >
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <Text fontSize={12} type={'secondary'}>
                    {t('workspace.status.model')}
                  </Text>
                  <Text ellipsis fontSize={12} style={{ maxWidth: 180 }} weight={500}>
                    {(provider && model && `${provider} / ${model}`) || '-'}
                  </Text>
                </Flexbox>
              </Block>
              <Block
                padding={'8px 10px'}
                style={{ borderRadius: 10, background: cssVar.colorFillQuaternary }}
              >
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <Text fontSize={12} type={'secondary'}>
                    {t('workspace.status.mcp')}
                  </Text>
                  <Tag color={isKlavisEnabled ? 'success' : undefined}>
                    {isKlavisEnabled ? t('workspace.status.on') : t('workspace.status.off')}
                  </Tag>
                </Flexbox>
              </Block>
              <Block
                padding={'8px 10px'}
                style={{ borderRadius: 10, background: cssVar.colorFillQuaternary }}
              >
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <Text fontSize={12} type={'secondary'}>
                    {t('workspace.status.skills')}
                  </Text>
                  <Tag color={isLobehubSkillEnabled ? 'success' : undefined}>
                    {isLobehubSkillEnabled ? t('workspace.status.on') : t('workspace.status.off')}
                  </Tag>
                </Flexbox>
              </Block>
              <Block
                padding={'8px 10px'}
                style={{ borderRadius: 10, background: cssVar.colorFillQuaternary }}
              >
                <Flexbox horizontal align={'center'} justify={'space-between'}>
                  <Text fontSize={12} type={'secondary'}>
                    {t('workspace.status.recent')}
                  </Text>
                  <Text fontSize={12} weight={500}>
                    {recentTopics.length} / {recentPages.length}
                  </Text>
                </Flexbox>
              </Block>
              {isTopicRevalidating && (
                <Flexbox horizontal align={'center'} gap={6}>
                  <WrenchIcon color={cssVar.colorTextTertiary} size={14} />
                  <Text fontSize={12} type={'secondary'}>
                    {t('workspace.status.syncing')}
                  </Text>
                </Flexbox>
              )}
            </Flexbox>
          </Flexbox>
        </Block>
      </Flexbox>

      <Block
        padding={16}
        variant={'outlined'}
        style={{
          borderRadius: 16,
          display: hideOtherModules ? 'none' : undefined,
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
  );
});

export default Home;
