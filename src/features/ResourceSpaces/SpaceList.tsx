'use client';

import { ActionIcon } from '@lobehub/ui';
import { HouseIcon, Settings2Icon, Users2Icon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import useSWR from 'swr';

import NavItem from '@/features/NavPanel/components/NavItem';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { lambdaClient } from '@/libs/trpc/client';

import { buildSpaceSettingsPath } from './paths';

export const SPACE_LIST_KEY = 'resource-space-list';

interface SpaceListProps {
  currentSpaceId?: string;
  onSelectSpace: (spaceId: string) => void;
}

const SpaceList = memo<SpaceListProps>(({ currentSpaceId, onSelectSpace }) => {
  const { t } = useTranslation('file');
  const location = useLocation();
  const navigate = useNavigate();

  const { data: spaces, isLoading } = useSWR(
    SPACE_LIST_KEY,
    () => lambdaClient.space.listSpaces.query(),
    {
      revalidateOnFocus: false,
    },
  );

  if (isLoading) return <SkeletonList rows={4} />;

  return spaces?.map((space) => {
    const isCurrentSettings =
      currentSpaceId === space.id && location.pathname.endsWith('/settings');

    return (
      <NavItem
        active={currentSpaceId === space.id}
        icon={space.kind === 'personal' ? HouseIcon : Users2Icon}
        key={space.id}
        title={space.name}
        extra={
          space.kind === 'team' ? (
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
          ) : undefined
        }
        onClick={() => onSelectSpace(space.id)}
      />
    );
  });
});

SpaceList.displayName = 'SpaceList';

export default SpaceList;
