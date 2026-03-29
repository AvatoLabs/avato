'use client';

import { ActionIcon, DropdownMenu } from '@lobehub/ui';
import { FileTextIcon, MoreHorizontal } from 'lucide-react';
import { memo, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { useInitRecentPage } from '@/hooks/useInitRecentPage';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { homeRecentSelectors } from '@/store/home/selectors';
import { useHomeStore } from '@/store/home/store';
import { FilesTabs } from '@/types/files';

import GroupBlock from '../components/GroupBlock';
import GroupSkeleton from '../components/GroupSkeleton';
import ScrollShadowWithButton from '../components/ScrollShadowWithButton';
import { RECENT_BLOCK_SIZE } from '../const';
import RecentPageList from './List';

const RecentPage = memo(() => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const setCategory = useContentManagerStore((s) => s.setCategory);
  const recentPages = useHomeStore(homeRecentSelectors.recentPages);
  const isInit = useHomeStore(homeRecentSelectors.isRecentPagesInit);
  const { isRevalidating } = useInitRecentPage();

  // After loaded, if no data, don't render
  if (isInit && (!recentPages || recentPages.length === 0)) {
    return null;
  }

  return (
    <GroupBlock
      icon={FileTextIcon}
      title={t('home.recentDocs', { defaultValue: 'Recent Docs' })}
      action={
        <>
          {isRevalidating && <NeuralNetworkLoading size={14} />}
          <DropdownMenu
            items={[
              {
                key: 'all-documents',
                label: t('menu.openDocs', { defaultValue: 'Open Docs' }),
                onClick: () => {
                  setCategory(FilesTabs.Documents);
                  navigate('/content');
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
              height={RECENT_BLOCK_SIZE.PAGE.HEIGHT}
              variant={'page'}
              width={RECENT_BLOCK_SIZE.PAGE.WIDTH}
            />
          }
        >
          <RecentPageList />
        </Suspense>
      </ScrollShadowWithButton>
    </GroupBlock>
  );
});

export default RecentPage;
