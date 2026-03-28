'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { FolderTreeIcon } from 'lucide-react';
import { type FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, useParams } from 'react-router-dom';

import MobileContentLayout from '@/components/server/MobileNavLayout';
import { MOBILE_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import BackButton from '@/features/NavPanel/components/BackButton';
import { buildResourceRootPath } from '@/features/ResourceSpaces';
import { LibraryTrashButton } from '@/routes/(main)/resource/features/LibraryTrashButton';
import LibraryFolderDrawer from '@/routes/(main)/resource/library/features/LibraryFolderDrawer';
import RegisterHotkeys from '@/routes/(main)/resource/library/features/RegisterHotkeys';
import { knowledgeBaseSelectors, useKnowledgeBaseStore } from '@/store/library';
import { useServerConfigStore } from '@/store/serverConfig';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import Sidebar from './Sidebar';
import { styles } from './style';

interface LibraryMobileHeaderProps {
  onFolderTreeClick?: () => void;
}

const LibraryMobileHeader: FC<LibraryMobileHeaderProps> = ({ onFolderTreeClick }) => {
  const { t } = useTranslation(['components', 'file']);
  const { id, spaceId } = useParams<{ id: string; spaceId?: string }>();
  const name = useKnowledgeBaseStore(knowledgeBaseSelectors.getKnowledgeBaseNameById(id || ''));
  const backPath = spaceId ? buildResourceRootPath(spaceId) : '/resource';

  return (
    <ChatHeader
      style={mobileHeaderSticky}
      left={
        <Flexbox align={'center'} gap={8} style={{ minWidth: 0 }}>
          <BackButton size={MOBILE_HEADER_ICON_SIZE} to={backPath} />
          <Text ellipsis fontSize={16} weight={500}>
            {name || '...'}
          </Text>
        </Flexbox>
      }
      right={
        <Flexbox align={'center'} gap={4}>
          {onFolderTreeClick && (
            <ActionIcon
              icon={FolderTreeIcon}
              size={MOBILE_HEADER_ICON_SIZE}
              title={t('FileManager.actions.showFolderTree', { ns: 'components' })}
              onClick={onFolderTreeClick}
            />
          )}
          <LibraryTrashButton knowledgeBaseId={id} spaceId={spaceId} />
        </Flexbox>
      }
    />
  );
};

const LibraryLayout: FC = () => {
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <MobileContentLayout
          withNav
          header={<LibraryMobileHeader onFolderTreeClick={() => setFolderDrawerOpen(true)} />}
        >
          <Outlet />
        </MobileContentLayout>
        <LibraryFolderDrawer open={folderDrawerOpen} onOpenChange={setFolderDrawerOpen} />
        <RegisterHotkeys />
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <Flexbox className={styles.mainContainer} flex={1} height={'100%'}>
        <Outlet />
      </Flexbox>
      <RegisterHotkeys />
    </>
  );
};

export default LibraryLayout;
