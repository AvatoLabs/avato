import { type MenuProps } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { App } from 'antd';
import { FileEdit, PencilLine, Trash } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { useSourceSetStore } from '@/store/sourceSet';

interface ProjectItemDropdownMenuProps {
  description?: string | null;
  id: string;
  name: string;
  toggleEditing: (visible?: boolean) => void;
}

export const useProjectItemDropdownMenu = ({
  description,
  id,
  name,
  toggleEditing,
}: ProjectItemDropdownMenuProps): (() => MenuProps['items']) => {
  const { t } = useTranslation(['home', 'common', 'sourceSet']);
  const [removeSourceSet] = useSourceSetStore((s) => [s.removeSourceSet]);
  const { modal } = App.useApp();
  const { open } = useCreateSourceSetModal();

  const handleEditDetails = useCallback(() => {
    open({
      id,
      initialValues: { description: description || '', name },
    });
  }, [description, id, name, open]);

  return useCallback(
    () => [
      {
        icon: <Icon icon={PencilLine} />,
        key: 'rename',
        label: t('rename', { ns: 'common' }),
        onClick: () => {
          toggleEditing(true);
        },
      },
      {
        icon: <Icon icon={FileEdit} />,
        key: 'editDetails',
        label: t('editDetails', { ns: 'sourceSet' }),
        onClick: () => {
          handleEditDetails();
        },
      },
      {
        type: 'divider',
      },
      {
        danger: true,
        icon: <Icon icon={Trash} />,
        key: 'delete',
        label: t('delete', { ns: 'common' }),
        onClick: () => {
          if (!id) return;
          modal.confirm({
            centered: true,
            okButtonProps: { danger: true },
            onOk: async () => {
              await removeSourceSet(id);
            },
            title: t('project.deleteConfirm'),
          });
        },
      },
    ],
    [t, id, modal, removeSourceSet, toggleEditing, handleEditDetails],
  );
};
