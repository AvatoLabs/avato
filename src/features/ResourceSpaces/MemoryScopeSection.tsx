'use client';

import { ActionIcon, Button, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { BrainCircuitIcon, PlusIcon, Users2Icon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';

import NavItem from '@/features/NavPanel/components/NavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { lambdaClient } from '@/libs/trpc/client';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

import { buildSpaceMemoryPath } from './paths';
import { resolveSpaceDisplayName } from './resolveSpaceDisplayName';
import { SPACE_LIST_KEY } from './SpaceList';
import {
  buildPendingGovernancePath,
  canReviewSpaceMemorySummary,
  useTeamSpaceMemoryScopeSummaries,
} from './useTeamSpaceMemoryScopeSummaries';
import { useOpenCreateSpaceModal } from './useOpenCreateSpaceModal';

const styles = createStaticStyles(({ css, cssVar }) => ({
  sectionTitle: css`
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin-block: 4px 2px;
    padding-inline: 8px 4px;

    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextDescription};
  `,
}));

interface MemoryScopeSectionProps {
  activeSpaceId?: string;
  currentScope: 'personal' | 'space';
}

const MemoryScopeSection = memo<MemoryScopeSectionProps>(({ activeSpaceId, currentScope }) => {
  const { t } = useTranslation(['file', 'memory']);
  const navigate = useNavigate();
  const username = useUserStore(userProfileSelectors.username);
  const fullName = useUserStore(userProfileSelectors.fullName);
  const openCreateSpace = useOpenCreateSpaceModal((spaceId) =>
    navigate(buildSpaceMemoryPath(spaceId)),
  );

  const { data: spaces, isLoading } = useSWR(
    SPACE_LIST_KEY,
    () => lambdaClient.space.listSpaces.query(),
    {
      revalidateOnFocus: false,
    },
  );

  const teamSpaces = spaces?.filter((space) => space.kind === 'team') ?? [];
  const { pendingGovernanceCountBySpaceId, pendingGovernanceTargetBySpaceId, spaceSummaryMap } =
    useTeamSpaceMemoryScopeSummaries(spaces);
  const teamSpaceItems = teamSpaces.map((space) => {
    const canReviewSpaceMemory = canReviewSpaceMemorySummary(spaceSummaryMap.get(space.id));
    const pendingCount = pendingGovernanceCountBySpaceId.get(space.id) ?? 0;
    const pendingTarget = pendingGovernanceTargetBySpaceId.get(space.id) ?? null;
    const showOpenMemoryAction = spaceSummaryMap.has(space.id) && !canReviewSpaceMemory;

    return (
      <NavItem
        active={currentScope === 'space' && activeSpaceId === space.id}
        extra={
          pendingCount > 0 ? (
            pendingTarget ? (
              <Button
                size={'small'}
                style={{ height: 'auto', paddingBlock: 0, paddingInline: 0 }}
                title={t('scope.pendingHint', { count: pendingCount, ns: 'memory' })}
                type={'text'}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  navigate(buildPendingGovernancePath(space.id, pendingTarget));
                }}
              >
                {t('scope.pending', { count: pendingCount, ns: 'memory' })}
              </Button>
            ) : (
              <Text
                fontSize={11}
                title={t('scope.pendingHint', { count: pendingCount, ns: 'memory' })}
                type={'secondary'}
              >
                {t('scope.pending', { count: pendingCount, ns: 'memory' })}
              </Text>
            )
          ) : showOpenMemoryAction ? (
            <Button
              size={'small'}
              style={{ height: 'auto', paddingBlock: 0, paddingInline: 0 }}
              title={t('scope.openHint', { ns: 'memory' })}
              type={'text'}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                navigate(buildSpaceMemoryPath(space.id));
              }}
            >
              {t('scope.open', { ns: 'memory' })}
            </Button>
          ) : undefined
        }
        icon={Users2Icon}
        key={space.id}
        title={resolveSpaceDisplayName(space, t, { fullName, username })}
        onClick={() => navigate(buildSpaceMemoryPath(space.id))}
      />
    );
  });

  return (
    <Flexbox gap={4} paddingInline={4}>
      <div className={styles.sectionTitle}>
        <Text fontSize={12} type={'secondary'} weight={500}>
          {t('scope.title', { ns: 'memory' })}
        </Text>
        <ActionIcon
          icon={PlusIcon}
          size={'small'}
          title={t('space.create.title', { ns: 'file' })}
          onClick={openCreateSpace}
        />
      </div>

      <NavItem
        active={currentScope === 'personal'}
        icon={BrainCircuitIcon}
        title={t('personalTitle', { ns: 'memory' })}
        onClick={() => navigate('/memory')}
      />

      <div className={styles.sectionTitle}>
        <Text fontSize={12} type={'secondary'} weight={500}>
          {t('scope.teamSpaces', { ns: 'memory' })}
        </Text>
      </div>

      {isLoading ? (
        <SkeletonList rows={3} />
      ) : teamSpaces.length === 0 ? (
        <Text fontSize={12} style={{ paddingInline: 8 }} type={'secondary'}>
          {t('scope.empty', { ns: 'memory' })}
        </Text>
      ) : (
        teamSpaceItems
      )}
    </Flexbox>
  );
});

MemoryScopeSection.displayName = 'MemoryScopeSection';

export default MemoryScopeSection;
