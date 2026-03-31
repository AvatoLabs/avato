'use client';

import {
  ActionIcon,
  type ActionIconProps,
  type DropdownItem,
  DropdownMenu,
  Icon,
} from '@lobehub/ui';
import { App } from 'antd';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { clearTreeStateForSourceSet } from '@/features/ContentManager/components/SourceSetTree';
import { useResourceShareModal } from '@/features/ResourceSharing';
import { buildContentRootPath } from '@/features/ResourceSpaces';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

interface SourceSetActionsProps {
  size?: ActionIconProps['size'];
}

const SourceSetActions = memo<SourceSetActionsProps>(({ size = 'small' as const }) => {
  const { t } = useTranslation(['common', 'file', 'sourceSet']);
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const { id = '', spaceId } = useParams<{ id?: string; spaceId?: string }>();
  const sourceSet = useSourceSetStore(sourceSetSelectors.getSourceSetById(id));
  const removeSourceSet = useSourceSetStore((s) => s.removeSourceSet);
  const { open: openSourceSetModal } = useCreateSourceSetModal();
  const { open: openShareModal } = useResourceShareModal();
  const [setMode, setSourceSetId] = useContentManagerStore((s) => [s.setMode, s.setSourceSetId]);

  const menuItems = useMemo<DropdownItem[]>(
    () => [
      {
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.page} />,
        key: 'edit',
        label: t('editDetails', { ns: 'sourceSet' }),
        onClick: () => {
          openSourceSetModal({
            id,
            initialValues: {
              description: sourceSet?.description || '',
              name: sourceSet?.name || '',
            },
            spaceId,
          });
        },
      },
      {
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.share} />,
        key: 'share',
        label: t('share.title', { ns: 'file' }),
        onClick: () => {
          openShareModal({
            id,
            kind: 'source_set',
            name: sourceSet?.name || '',
          });
        },
      },
      { type: 'divider' },
      {
        danger: true,
        icon: <Icon icon={RESOURCE_ENTRY_ICONS.trash} />,
        key: 'delete',
        label: t('delete', { ns: 'common' }),
        onClick: () => {
          modal.confirm({
            centered: true,
            okButtonProps: { danger: true },
            onOk: async () => {
              await removeSourceSet(id);
              clearTreeStateForSourceSet(id);
              setSourceSetId(undefined);
              setMode('explorer');
              navigate(buildContentRootPath(spaceId));
            },
            title: t('sourceSet.list.confirmRemoveSourceSet', { ns: 'file' }),
          });
        },
      },
    ],
    [
      id,
      modal,
      navigate,
      openShareModal,
      openSourceSetModal,
      removeSourceSet,
      setMode,
      setSourceSetId,
      sourceSet?.description,
      sourceSet?.name,
      spaceId,
      t,
    ],
  );

  return (
    <DropdownMenu items={menuItems} nativeButton={false} placement="bottomRight">
      <ActionIcon icon={RESOURCE_ENTRY_ICONS.more} size={size} />
    </DropdownMenu>
  );
});

SourceSetActions.displayName = 'SourceSetActions';

export default SourceSetActions;
