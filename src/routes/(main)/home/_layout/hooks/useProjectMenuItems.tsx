import { Icon } from '@lobehub/ui';
import { type ItemType } from 'antd/es/menu/interface';
import { BoxIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useCreateSourceSetModal } from '@/features/SourceSetModal';

/**
 * Hook for generating menu items/buttons for knowledge base actions
 * Used in Body/Project/Actions.tsx
 */
export const useProjectMenuItems = () => {
  const { t } = useTranslation('sourceSet');
  const navigate = useNavigate();
  const { open } = useCreateSourceSetModal();

  /**
   * Create knowledge base action
   */
  const createProject = useCallback(() => {
    open({
      onSuccess: (id) => {
        navigate(`/knowledge/bases/${id}`);
      },
    });
  }, [open, navigate]);

  const createProjectMenuItem = useCallback(
    (): ItemType => ({
      icon: <Icon icon={BoxIcon} />,
      key: 'createProject',
      label: t('createNew.title'),
      onClick: (info) => {
        info.domEvent?.stopPropagation();
        createProject();
      },
    }),
    [t, createProject],
  );

  return {
    createProject,
    createProjectMenuItem,
  };
};
