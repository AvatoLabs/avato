'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
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
        teamSpaces.map((space) => (
          <NavItem
            active={currentScope === 'space' && activeSpaceId === space.id}
            icon={Users2Icon}
            key={space.id}
            title={resolveSpaceDisplayName(space, t, { fullName, username })}
            onClick={() => navigate(buildSpaceMemoryPath(space.id))}
          />
        ))
      )}
    </Flexbox>
  );
});

MemoryScopeSection.displayName = 'MemoryScopeSection';

export default MemoryScopeSection;
