'use client';

import { ActionIcon, Button, Flexbox, Icon, Modal, Text } from '@lobehub/ui';
import { createModal } from '@lobehub/ui/base-ui';
import { ChatHeader } from '@lobehub/ui/mobile';
import {
  ChevronDownIcon,
  HouseIcon,
  PlusIcon,
  Settings2Icon,
  Share2Icon,
  Users2Icon,
} from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import NavItem from '@/features/NavPanel/components/NavItem';
import {
  buildContentRootPath,
  buildContentTrashPath,
  buildSharedContentPath,
  buildSpaceSettingsPath,
} from '@/features/ResourceSpaces';
import { CreateSpaceForm } from '@/features/ResourceSpaces/SpaceSection';
import { lambdaClient } from '@/libs/trpc/client';
import { SourceSetTrashButton } from '@/routes/(main)/content/features/SourceSetTrashButton';
import { mobileHeaderSticky } from '@/styles/mobileHeader';

import CategoryMenu from './Header/CategoryMenu';

const SPACE_LIST_KEY = 'content-space-list';

const ResourceMobileHeader = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const navigate = useNavigate();
  const location = useLocation();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  const {
    data: spaces,
    isLoading,
    mutate,
  } = useSWR(SPACE_LIST_KEY, () => lambdaClient.space.listSpaces.query(), {
    revalidateOnFocus: false,
  });

  const isOnShared = location.pathname === buildSharedContentPath();
  const isOnTrash = location.pathname === buildContentTrashPath(currentSpaceId);
  const currentSpace = spaces?.find((s) => s.id === currentSpaceId);

  const handleCreateSpace = useCallback(() => {
    createModal({
      children: (
        <CreateSpaceForm
          onCreated={(spaceId) => {
            void mutate();
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
          : currentSpace?.name || (isLoading ? '...' : t('tab.resource'))}
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
          {spaces?.map((space) => {
            const active = currentSpaceId === space.id && !location.pathname.endsWith('/settings');
            const isCurrentSettings =
              currentSpaceId === space.id && location.pathname.endsWith('/settings');
            return (
              <Flexbox horizontal align={'center'} justify={'space-between'} key={space.id}>
                <NavItem
                  active={active}
                  icon={space.kind === 'personal' ? HouseIcon : Users2Icon}
                  style={{ flex: 1 }}
                  title={space.name}
                  onClick={() => {
                    navigate(buildContentRootPath(space.id));
                    setWorkspaceOpen(false);
                  }}
                />
                {space.kind === 'team' && (
                  <ActionIcon
                    active={isCurrentSettings}
                    icon={Settings2Icon}
                    size={'small'}
                    title={t('space.settings.title', { ns: 'file' })}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(buildSpaceSettingsPath(space.id));
                      setWorkspaceOpen(false);
                    }}
                  />
                )}
              </Flexbox>
            );
          })}
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
