'use client';

import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import { Clock, MoreHorizontal } from 'lucide-react';
import { memo, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { buildFilesRootPath } from '@/features/ResourceSpaces';
import { getActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useInitRecentResource } from '@/hooks/useInitRecentResource';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { homeRecentSelectors } from '@/store/home/selectors';
import { useHomeStore } from '@/store/home/store';
import { FilesTabs } from '@/types/files';

import GroupBlock from '../components/GroupBlock';
import GroupSkeleton from '../components/GroupSkeleton';
import ScrollShadowWithButton from '../components/ScrollShadowWithButton';
import { RECENT_BLOCK_SIZE } from '../const';
import RecentResourceList from './List';

const RecentResource = memo(() => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const setCategory = useContentManagerStore((s) => s.setCategory);
  const recentResources = useHomeStore(homeRecentSelectors.recentResources);
  const isInit = useHomeStore(homeRecentSelectors.isRecentResourcesInit);
  const { isRevalidating } = useInitRecentResource();

  // After loaded, if no data, don't render
  if (isInit && (!recentResources || recentResources.length === 0)) {
    return null;
  }

  return (
    <GroupBlock
      icon={Clock}
      title={t('home.recentFiles')}
      action={
        <>
          {isRevalidating && <NeuralNetworkLoading size={14} />}
          <DropdownMenu
            items={[
              {
                key: 'all-files',
                label: t('menu.openHome', { defaultValue: 'Open Home' }),
                onClick: () => {
                  setCategory(FilesTabs.Home);
                  navigate(buildFilesRootPath(getActiveWorkspaceSpaceId()));
                },
              },
            ]}
          >
            <ActionIcon icon={MoreHorizontal} size="small" />
          </DropdownMenu>
        </>
      }
    >
      <ScrollShadowWithButton>
        <Suspense
          fallback={
            <GroupSkeleton
              height={RECENT_BLOCK_SIZE.RESOURCE.HEIGHT}
              variant={'resource'}
              width={RECENT_BLOCK_SIZE.RESOURCE.WIDTH}
            />
          }
        >
          <RecentResourceList />
        </Suspense>
      </ScrollShadowWithButton>
    </GroupBlock>
  );
});

export default RecentResource;
