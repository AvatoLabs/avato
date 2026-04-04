'use client';

import { Button, Flexbox, Icon, Modal, Text } from '@lobehub/ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { ChevronDownIcon, PlusIcon, Share2Icon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import NavItem from '@/features/NavPanel/components/NavItem';
import {
  buildFilesRootPath,
  buildFilesTrashPath,
  buildSharedFilesPath,
  SpaceList,
  useSpaceName,
} from '@/features/ResourceSpaces';
import { useOpenCreateSpaceModal } from '@/features/ResourceSpaces/useOpenCreateSpaceModal';
import { SourceSetTrashButton } from '@/routes/(main)/content/features/SourceSetTrashButton';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import CategoryMenu from './Header/CategoryMenu';

const ResourceMobileHeader = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const navigate = useNavigate();
  const location = useLocation();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const currentSpaceName = useSpaceName(currentSpaceId);

  const isOnShared = location.pathname === buildSharedFilesPath();
  const isOnTrash = location.pathname === buildFilesTrashPath(currentSpaceId);

  const handleCreateSpace = useOpenCreateSpaceModal((spaceId) => {
    navigate(buildFilesRootPath(spaceId));
    setWorkspaceOpen(false);
  });

  const leftContent = (
    <Flexbox
      align={'center'}
      gap={4}
      style={{ cursor: 'pointer', minWidth: 0 }}
      onClick={() => setWorkspaceOpen(true)}
    >
      <Text ellipsis fontSize={16} weight={500}>
        {isOnShared
          ? t('shared.title', { ns: 'file' })
          : currentSpaceName || t('space.sectionTitle', { ns: 'file' })}
      </Text>
      <Icon icon={ChevronDownIcon} size={16} />
    </Flexbox>
  );

  const isOnSettings = location.pathname.endsWith('/settings');

  return (
    <>
      <ChatHeader
        left={leftContent}
        right={<SourceSetTrashButton />}
        style={{ ...mobileHeaderSticky, overflow: 'unset' }}
      />
      {!isOnSettings && !isOnShared && !isOnTrash && currentSpaceId && (
        <Flexbox gap={4} paddingBlock={4} paddingInline={12} style={{ flexShrink: 0 }}>
          <CategoryMenu />
        </Flexbox>
      )}
      <Modal
        open={workspaceOpen}
        title={t('space.sectionTitle', { ns: 'file' })}
        onCancel={() => setWorkspaceOpen(false)}
      >
        <Flexbox gap={1} paddingBlock={8} paddingInline={4}>
          <NavItem
            active={isOnShared}
            icon={Share2Icon}
            title={t('shared.title', { ns: 'file' })}
            onClick={() => {
              navigate(buildSharedFilesPath());
              setWorkspaceOpen(false);
            }}
          />
          <NavItem
            active={isOnTrash}
            icon={RESOURCE_ENTRY_ICONS.trash}
            title={t('trash.title', { ns: 'file' })}
            onClick={() => {
              navigate(buildFilesTrashPath(currentSpaceId));
              setWorkspaceOpen(false);
            }}
          />
          <SpaceList
            currentSpaceId={currentSpaceId}
            onSelectSpace={(spaceId) => {
              navigate(buildFilesRootPath(spaceId));
              setWorkspaceOpen(false);
            }}
          />
          <Flexbox paddingBlock={8} paddingInline={4}>
            <Button block icon={<Icon icon={PlusIcon} />} onClick={handleCreateSpace}>
              {t('space.create.title', { ns: 'file' })}
            </Button>
          </Flexbox>
        </Flexbox>
      </Modal>
    </>
  );
});

ResourceMobileHeader.displayName = 'ResourceMobileHeader';

export default ResourceMobileHeader;
