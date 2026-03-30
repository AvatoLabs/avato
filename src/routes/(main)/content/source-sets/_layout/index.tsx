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
import RegisterHotkeys from '@/routes/(main)/content/source-sets/features/RegisterHotkeys';
import SourceSetFolderDrawer from '@/routes/(main)/content/source-sets/features/SourceSetFolderDrawer';
import { useSourceSetBackPath } from '@/routes/(main)/content/source-sets/features/useSourceSetBackPath';
import { useServerConfigStore } from '@/store/serverConfig';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import SourceSetActions from './Header/SourceSetActions';
import Sidebar from './Sidebar';
import { styles } from './style';

interface SourceSetMobileHeaderProps {
  onFolderTreeClick?: () => void;
}

const SourceSetMobileHeader: FC<SourceSetMobileHeaderProps> = ({ onFolderTreeClick }) => {
  const { t } = useTranslation(['components', 'file']);
  const { id } = useParams<{ id: string; spaceId?: string }>();
  const name = useSourceSetStore(sourceSetSelectors.getSourceSetNameById(id || ''));
  const backPath = useSourceSetBackPath();

  return (
    <ChatHeader
      style={mobileHeaderSticky}
      left={
        <Flexbox align={'center'} gap={8} style={{ minWidth: 0 }}>
          <BackButton size={MOBILE_HEADER_ICON_SIZE} to={backPath} useHistory={false} />
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
          <SourceSetActions size={MOBILE_HEADER_ICON_SIZE} />
        </Flexbox>
      }
    />
  );
};

const SourceSetLayout: FC = () => {
  const isMobile = useServerConfigStore((s) => s.isMobile);
  const [folderDrawerOpen, setFolderDrawerOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <MobileContentLayout
          withNav
          header={<SourceSetMobileHeader onFolderTreeClick={() => setFolderDrawerOpen(true)} />}
        >
          <Outlet />
        </MobileContentLayout>
        <SourceSetFolderDrawer open={folderDrawerOpen} onOpenChange={setFolderDrawerOpen} />
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

export default SourceSetLayout;
