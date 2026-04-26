import { type MenuProps } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { App } from 'antd';
import { Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useHomeStore } from '@/store/home/store';

interface UseDropdownMenuProps {
  agentId: string;
  agentTitle: string;
  isBuiltinAgent: boolean;
  onClose: () => void;
}

export const useDropdownMenu = ({
  agentId,
  isBuiltinAgent,
  onClose,
}: UseDropdownMenuProps): MenuProps['items'] => {
  const { t } = useTranslation(['common', 'chat']);
  const { message, modal } = App.useApp();
  const removeAgent = useHomeStore((s) => s.removeAgent);

  const handleDelete = () => {
    modal.confirm({
      cancelText: t('cancel'),
      centered: true,
      okButtonProps: { danger: true },
      okText: t('delete'),
      onOk: async () => {
        try {
          await removeAgent(agentId);
          message.success(t('confirmRemoveSessionSuccess', { ns: 'chat' }));
          onClose();
        } catch (error) {
          console.error('Failed to delete copilot agent:', error);
          message.error(t('confirmRemoveSessionError', { ns: 'chat' }));
        }
      },
      title: t('confirmRemoveSessionItemAlert', { ns: 'chat' }),
    });
  };

  return useMemo(() => {
    if (isBuiltinAgent) return [];

    return [
      {
        danger: true,
        icon: <Icon icon={Trash2} />,
        key: 'delete',
        label: t('delete'),
        onClick: handleDelete,
      },
    ].filter(Boolean) as MenuProps['items'];
  }, [t, isBuiltinAgent, handleDelete]);
};
