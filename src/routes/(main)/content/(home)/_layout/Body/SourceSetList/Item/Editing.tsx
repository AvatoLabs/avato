import { Input, Popover, stopPropagation } from '@lobehub/ui';
import { memo, useCallback, useEffect, useState } from 'react';

import { useSourceSetStore } from '@/store/sourceSet';

interface EditingProps {
  id: string;
  name: string;
  toggleEditing: (visible?: boolean) => void;
}

const Editing = memo<EditingProps>(({ id, name, toggleEditing }) => {
  const [editing, updateSourceSet] = useSourceSetStore((s) => [
    s.sourceSetRenamingId === id,
    s.updateSourceSet,
  ]);

  const [newName, setNewName] = useState(name);

  // Reset state when editing starts
  useEffect(() => {
    if (editing) {
      setNewName(name);
    }
  }, [editing, name]);

  const handleUpdate = useCallback(() => {
    if (newName && name !== newName) {
      updateSourceSet(id, { name: newName });
    }
    toggleEditing(false);
  }, [newName, name, id, updateSourceSet, toggleEditing]);

  return (
    <Popover
      nativeButton={false}
      open={editing}
      placement="bottomLeft"
      trigger="click"
      content={
        <Input
          autoFocus
          defaultValue={name}
          maxLength={64}
          onChange={(e) => setNewName(e.target.value)}
          onClick={stopPropagation}
          onBlur={() => {
            handleUpdate();
            toggleEditing(false);
          }}
          onPressEnter={() => {
            handleUpdate();
            toggleEditing(false);
          }}
        />
      }
      styles={{
        content: {
          padding: 4,
          width: 320,
        },
      }}
      onOpenChange={(open) => {
        if (!open) handleUpdate();
        toggleEditing(open);
      }}
    >
      <div />
    </Popover>
  );
});

export default Editing;
