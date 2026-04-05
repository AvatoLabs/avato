'use client';

import { Flexbox, Icon, Tag, Text } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { BrainCircuitIcon, Files, FileText, FolderKanban, Settings2, Users2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';
import { getPageRootPath } from '@/utils/docs';

import {
  buildFilesRootPath,
  buildSpaceMemoryPath,
  buildSpaceMembersPath,
  buildSpaceSettingsPath,
} from './paths';
import { resolveSpaceDisplayName } from './resolveSpaceDisplayName';
import {
  buildPendingGovernancePath,
  canReviewSpaceMemorySummary,
  REVIEWED_MEMORY_SECTIONS,
  useTeamSpaceMemoryScopeSummaries,
} from './useTeamSpaceMemoryScopeSummaries';

const useStyles = createStyles(({ css, token }) => ({
  card: css`
    min-width: 0;
    padding: 18px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
    color: inherit;
    text-decoration: none;
    transition:
      border-color ${token.motionDurationMid},
      transform ${token.motionDurationMid},
      box-shadow ${token.motionDurationMid};

    &:hover {
      border-color: ${token.colorPrimaryBorder};
      transform: translateY(-1px);
      box-shadow: ${token.boxShadowSecondary};
    }

    &:focus-visible {
      outline: 2px solid ${token.colorPrimary};
      outline-offset: 3px;
    }
  `,
  cardGrid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,
  page: css`
    overflow: auto;
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 28px;

    @media (max-width: 640px) {
      padding: 20px 16px;
    }
  `,
  title: css`
    text-wrap: balance;
  `,
  overviewCard: css`
    padding: 18px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  overviewActions: css`
    display: flex;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  `,
  overviewLink: css`
    color: ${token.colorPrimary};
    font-weight: 500;
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  `,
}));

const SpaceHomePage = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const { styles } = useStyles();
  const { spaceId } = useParams<{ spaceId?: string }>();
  const username = useUserStore(userProfileSelectors.username);
  const fullName = useUserStore(userProfileSelectors.fullName);

  const { data: space, isLoading } = useSWR(
    spaceId ? ['space', spaceId] : null,
    () => lambdaClient.space.getSpace.query({ id: spaceId! }),
    { revalidateOnFocus: false },
  );

  if (!spaceId) return null;
  if (isLoading) return <Loading debugId="SpaceHomePage" />;
  if (!space) return null;

  const isTeamSpace = space.kind === 'team';
  const { pendingGovernanceCountBySpaceId, pendingGovernanceTargetBySpaceId, spaceSummaryMap } =
    useTeamSpaceMemoryScopeSummaries(isTeamSpace ? [space] : undefined);
  const displayName = resolveSpaceDisplayName(space, t, { fullName, username });
  const spaceMemorySummary = spaceSummaryMap.get(spaceId);
  const canReviewSpaceMemory = canReviewSpaceMemorySummary(spaceMemorySummary);
  const pendingCount = pendingGovernanceCountBySpaceId.get(spaceId) ?? 0;
  const pendingTarget = pendingGovernanceTargetBySpaceId.get(spaceId) ?? null;
  const recallOverview = spaceMemorySummary
    ? REVIEWED_MEMORY_SECTIONS.reduce(
        (acc, section) => {
          const recall = spaceMemorySummary.sections[section].recall;

          return {
            active: acc.active + recall.active,
            disabled: acc.disabled + recall.disabled,
            expired: acc.expired + recall.expired,
            stale: acc.stale + recall.stale,
          };
        },
        { active: 0, disabled: 0, expired: 0, stale: 0 },
      )
    : null;
  const cards = [
    {
      description: t('space.home.cards.docs.description', { ns: 'file' }),
      href: getPageRootPath('doc', spaceId),
      icon: FileText,
      key: 'docs',
      title: t('tab.pages', { ns: 'common' }),
    },
    {
      description: t('space.home.cards.files.description', { ns: 'file' }),
      href: buildFilesRootPath(spaceId),
      icon: Files,
      key: 'files',
      title: t('tab.files', { ns: 'common' }),
    },
    {
      description: t('space.home.cards.sourceSets.description', { ns: 'file' }),
      href: buildFilesRootPath(spaceId),
      icon: FolderKanban,
      key: 'source-sets',
      title: t('sourceSet.title', { ns: 'file' }),
    },
    {
      description: t(
        isTeamSpace
          ? 'space.home.cards.memory.teamDescription'
          : 'space.home.cards.memory.personalDescription',
        { ns: 'file' },
      ),
      href: buildSpaceMemoryPath(spaceId),
      icon: BrainCircuitIcon,
      key: 'memory',
      title: t('tab.memory', { ns: 'common' }),
    },
    {
      description: t('space.home.cards.members.description', { ns: 'file' }),
      href: buildSpaceMembersPath(spaceId),
      icon: Users2,
      key: 'members',
      title: t('space.members.title', { ns: 'file' }),
    },
    {
      description: t('space.home.cards.settings.description', { ns: 'file' }),
      href: buildSpaceSettingsPath(spaceId),
      icon: Settings2,
      key: 'settings',
      title: t('space.settings.title', { ns: 'file' }),
    },
  ];

  return (
    <Flexbox className={styles.page} gap={24}>
      <Flexbox gap={10}>
        <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
          <Text as={'h1'} className={styles.title} fontSize={32} style={{ margin: 0 }} weight={700}>
            {displayName}
          </Text>
          <Tag size={'small'} variant={'filled'}>
            {t(isTeamSpace ? 'space.home.badges.team' : 'space.home.badges.personal', {
              ns: 'file',
            })}
          </Tag>
          {space.membershipRole && (
            <Tag size={'small'} variant={'outlined'}>
              {t(`space.roles.${space.membershipRole}`, { ns: 'file' })}
            </Tag>
          )}
        </Flexbox>
        <Text type={'secondary'}>
          {space.description ||
            t(
              isTeamSpace
                ? 'space.home.description.teamFallback'
                : 'space.home.description.personalFallback',
              { ns: 'file' },
            )}
        </Text>
      </Flexbox>

      {isTeamSpace && canReviewSpaceMemory && recallOverview && (
        <Flexbox className={styles.overviewCard} gap={14}>
          <Flexbox horizontal align={'start'} justify={'space-between'} gap={12} wrap={'wrap'}>
            <Flexbox gap={4}>
              <Text fontSize={18} weight={600}>
                {t('space.home.recall.title', { ns: 'file' })}
              </Text>
              <Text type={'secondary'}>
                {pendingCount > 0
                  ? t('space.home.recall.description.pending', { count: pendingCount, ns: 'file' })
                  : t('space.home.recall.description.clear', { ns: 'file' })}
              </Text>
            </Flexbox>
            <div className={styles.overviewActions}>
              {pendingTarget && pendingCount > 0 && (
                <Link
                  className={styles.overviewLink}
                  to={buildPendingGovernancePath(spaceId, pendingTarget)}
                >
                  {t('space.home.recall.actions.review', { count: pendingCount, ns: 'file' })}
                </Link>
              )}
              <Link className={styles.overviewLink} to={buildSpaceMemoryPath(spaceId)}>
                {t('space.home.recall.actions.open', { ns: 'file' })}
              </Link>
            </div>
          </Flexbox>

          <Flexbox horizontal gap={8} wrap={'wrap'}>
            <Tag size={'small'} variant={recallOverview.active > 0 ? 'filled' : 'outlined'}>
              {t('space.home.recall.metrics.active', {
                count: recallOverview.active,
                ns: 'file',
              })}
            </Tag>
            <Tag size={'small'} variant={recallOverview.disabled > 0 ? 'filled' : 'outlined'}>
              {t('space.home.recall.metrics.paused', {
                count: recallOverview.disabled,
                ns: 'file',
              })}
            </Tag>
            <Tag size={'small'} variant={recallOverview.expired > 0 ? 'filled' : 'outlined'}>
              {t('space.home.recall.metrics.expired', {
                count: recallOverview.expired,
                ns: 'file',
              })}
            </Tag>
            <Tag size={'small'} variant={recallOverview.stale > 0 ? 'filled' : 'outlined'}>
              {t('space.home.recall.metrics.stale', {
                count: recallOverview.stale,
                ns: 'file',
              })}
            </Tag>
          </Flexbox>
        </Flexbox>
      )}

      <div className={styles.cardGrid}>
        {cards.map((card) => (
          <Link className={styles.card} key={card.key} to={card.href}>
            <Flexbox gap={10}>
              <Flexbox horizontal align={'center'} gap={10}>
                <Icon icon={card.icon} size={{ size: 20, strokeWidth: 2.1 }} />
                <Text fontSize={18} weight={600}>
                  {card.title}
                </Text>
              </Flexbox>
              <Text type={'secondary'}>{card.description}</Text>
            </Flexbox>
          </Link>
        ))}
      </div>
    </Flexbox>
  );
});

SpaceHomePage.displayName = 'SpaceHomePage';

export default SpaceHomePage;
