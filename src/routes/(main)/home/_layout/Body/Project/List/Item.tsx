import { BoxIcon } from 'lucide-react';
import { memo, useCallback } from 'react';

import NavItem from '@/features/NavPanel/components/NavItem';
import { useSourceSetStore } from '@/store/sourceSet';

import Actions from './Actions';
import Editing from './Editing';
import { useProjectItemDropdownMenu } from './useDropdownMenu';

interface ProjectItemProps {
  description?: string | null;
  id: string;
  name: string;
}

const ProjectItem = memo<ProjectItemProps>(({ description, id, name }) => {
  const [editing, isLoading, isUpdating] = useSourceSetStore((s) => [
    s.sourceSetRenamingId === id,
    s.sourceSetLoadingIds.includes(id),
    s.sourceSetUpdatingId === id,
  ]);

  const toggleEditing = useCallback(
    (visible?: boolean) => {
      useSourceSetStore.setState(
        { sourceSetRenamingId: visible ? id : null },
        false,
        'toggleEditing',
      );
    },
    [id],
  );

  const dropdownMenu = useProjectItemDropdownMenu({
    description,
    id,
    name,
    toggleEditing,
  });

  return (
    <>
      <NavItem
        actions={<Actions dropdownMenu={dropdownMenu} />}
        contextMenuItems={dropdownMenu}
        disabled={editing || isUpdating}
        icon={BoxIcon}
        loading={isLoading || isUpdating}
        title={name}
      />
      <Editing id={id} name={name} toggleEditing={toggleEditing} />
    </>
  );
});

export default ProjectItem;
