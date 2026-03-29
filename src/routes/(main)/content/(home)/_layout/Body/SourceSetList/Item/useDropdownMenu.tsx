import { type MenuProps } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { App } from 'antd';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { useSourceSetStore } from '@/store/sourceSet';

interface ActionProps {
  description?: string | null;
  id: string;
  name: string;
  onShare: () => void;
  spaceId?: string;
  toggleEditing: (visible?: boolean) => void;
}

export const useDropdownMenu = ({
  id,
  name,
  description,
  onShare,
  spaceId,
  toggleEditing,
}: ActionProps): (() => MenuProps['items']) => {
  const { t } = useTranslation(['file', 'common', 'sourceSet']);
  const { modal } = App.useApp();
  const removeSourceSet = useSourceSetStore((s) => s.removeSourceSet);
  const { open } = useCreateSourceSetModal();

  const handleDelete = () => {
    if (!id) return;

    modal.confirm({
      centered: true,
      okButtonProps: { danger: true },
      onOk: async () => {
        await removeSourceSet(id);
      },
      title: t('sourceSet.list.confirmRemoveSourceSet'),
    });
  };

  const handleEditDescription = () => {
    open({
      id,
      initialValues: { description: description || '', name },
      spaceId,
    });
  };

  return useCallback(
    () =>
      [
        {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.edit} />,
          key: 'rename',
          label: t('rename', { ns: 'common' }),
          onClick: (info: any) => {
            info.domEvent?.stopPropagation();
            toggleEditing(true);
          },
        },
        {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.page} />,
          key: 'editDescription',
          label: t('editDetails', { ns: 'sourceSet' }),
          onClick: (info: any) => {
            info.domEvent?.stopPropagation();
            handleEditDescription();
          },
        },
        {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.share} />,
          key: 'share',
          label: t('share.title', { ns: 'file' }),
          onClick: (info: any) => {
            info.domEvent?.stopPropagation();
            onShare();
          },
        },
        { type: 'divider' },
        {
          danger: true,
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.trash} />,
          key: 'delete',
          label: t('delete', { ns: 'common' }),
          onClick: handleDelete,
        },
      ].filter(Boolean) as MenuProps['items'],
    [
      description,
      handleDelete,
      handleEditDescription,
      id,
      modal,
      name,
      onShare,
      open,
      removeSourceSet,
      t,
      toggleEditing,
    ],
  );
};
