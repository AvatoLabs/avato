'use client';

import { ActionIcon, Button, Flexbox, Text } from '@lobehub/ui';
import { HouseIcon, Settings2Icon, Users2Icon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import useSWR from 'swr';

import NavItem from '@/features/NavPanel/components/NavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { lambdaClient } from '@/libs/trpc/client';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

import { buildSpaceMemoryPath, buildSpaceSettingsPath } from './paths';
import { resolveSpaceDisplayName } from './resolveSpaceDisplayName';
import {
  buildPendingGovernancePath,
  canReviewSpaceMemorySummary,
  useTeamSpaceMemoryScopeSummaries,
} from './useTeamSpaceMemoryScopeSummaries';

export const SPACE_LIST_KEY = 'resource-space-list';

interface SpaceListProps {
  currentSpaceId?: string;
  onSelectSpace: (spaceId: string) => void;
}

const SpaceList = memo<SpaceListProps>(({ currentSpaceId, onSelectSpace }) => {
  const { t } = useTranslation(['file', 'memory']);
  const location = useLocation();
  const navigate = useNavigate();
  const username = useUserStore(userProfileSelectors.username);
  const fullName = useUserStore(userProfileSelectors.fullName);

  const { data: spaces, isLoading } = useSWR(
    SPACE_LIST_KEY,
    () => lambdaClient.space.listSpaces.query(),
    {
      revalidateOnFocus: false,
    },
  );
  const { pendingGovernanceCountBySpaceId, pendingGovernanceTargetBySpaceId, spaceSummaryMap } =
    useTeamSpaceMemoryScopeSummaries(spaces);

  if (isLoading) return <SkeletonList rows={4} />;

  return spaces?.map((space) => {
    const isCurrentSettings =
      currentSpaceId === space.id && location.pathname.endsWith('/settings');
    const displayName = resolveSpaceDisplayName(space, t, { fullName, username });
    const canReviewSpaceMemory = canReviewSpaceMemorySummary(spaceSummaryMap.get(space.id));
    const pendingCount = pendingGovernanceCountBySpaceId.get(space.id) ?? 0;
    const pendingTarget = pendingGovernanceTargetBySpaceId.get(space.id) ?? null;
    const showOpenMemoryAction = spaceSummaryMap.has(space.id) && !canReviewSpaceMemory;

    return (
      <NavItem
        active={currentSpaceId === space.id}
        icon={space.kind === 'personal' ? HouseIcon : Users2Icon}
        key={space.id}
        title={displayName}
        extra={
          space.kind === 'team' ? (
            <Flexbox horizontal align={'center'} gap={6}>
              {pendingCount > 0 &&
                (pendingTarget ? (
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
                ))}
              {pendingCount === 0 && showOpenMemoryAction && (
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
              )}
              <ActionIcon
                active={isCurrentSettings}
                icon={Settings2Icon}
                size={'small'}
                title={t('space.settings.title')}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  navigate(buildSpaceSettingsPath(space.id));
                }}
              />
            </Flexbox>
          ) : undefined
        }
        onClick={() => onSelectSpace(space.id)}
      />
    );
  });
});

SpaceList.displayName = 'SpaceList';

export default SpaceList;
