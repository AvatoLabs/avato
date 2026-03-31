'use client';

import { Button, Flexbox, Icon, Modal, Text } from '@lobehub/ui';
import { createModal } from '@lobehub/ui/base-ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import { ChevronDownIcon, PlusIcon, Share2Icon } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSWRConfig } from 'swr';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import NavItem from '@/features/NavPanel/components/NavItem';
import {
  buildContentRootPath,
  buildContentTrashPath,
  buildSharedContentPath,
  SpaceList,
  useSpaceName,
} from '@/features/ResourceSpaces';
import { SPACE_LIST_KEY } from '@/features/ResourceSpaces/SpaceList';
import { CreateSpaceForm } from '@/features/ResourceSpaces/SpaceSection';
import { SourceSetTrashButton } from '@/routes/(main)/content/features/SourceSetTrashButton';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import CategoryMenu from './Header/CategoryMenu';

const ResourceMobileHeader = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const navigate = useNavigate();
  const location = useLocation();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const { mutate } = useSWRConfig();
  const currentSpaceName = useSpaceName(currentSpaceId);

  const isOnShared = location.pathname === buildSharedContentPath();
  const isOnTrash = location.pathname === buildContentTrashPath(currentSpaceId);

  const handleCreateSpace = useCallback(() => {
    createModal({
      children: (
        <CreateSpaceForm
          onCreated={(spaceId) => {
            void mutate(SPACE_LIST_KEY);
            navigate(buildContentRootPath(spaceId));
            setWorkspaceOpen(false);
          }}
        />
      ),
      footer: null,
      title: t('space.create.title', { ns: 'file' }),
      width: 420,
    });
  }, [mutate, navigate, t]);

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
              navigate(buildSharedContentPath());
              setWorkspaceOpen(false);
            }}
          />
          <NavItem
            active={isOnTrash}
            icon={RESOURCE_ENTRY_ICONS.trash}
            title={t('trash.title', { ns: 'file' })}
            onClick={() => {
              navigate(buildContentTrashPath(currentSpaceId));
              setWorkspaceOpen(false);
            }}
          />
          <SpaceList
            currentSpaceId={currentSpaceId}
            onSelectSpace={(spaceId) => {
              navigate(buildContentRootPath(spaceId));
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
