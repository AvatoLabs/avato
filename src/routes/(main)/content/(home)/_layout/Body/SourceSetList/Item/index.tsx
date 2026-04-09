import { Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { type CSSProperties } from 'react';
import React, { memo, useCallback, useMemo } from 'react';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { buildSourceSetFileScope, useFileScope } from '@/features/ContentManager/useFileScope';
import NavItem from '@/features/NavPanel/components/NavItem';
import { useResourceShareModal } from '@/features/ResourceSharing';
import { useSourceSetStore } from '@/store/sourceSet';

import Actions from './Actions';
import Editing from './Editing';
import { useDropdownMenu } from './useDropdownMenu';

interface SourceSetItemProps {
  active?: boolean;
  className?: string;
  description?: string | null;
  id: string;
  name: string;
  spaceId?: string | null;
  style?: CSSProperties;
}

const SourceSetItem = memo<SourceSetItemProps>(
  ({ id, name, description, active, style, className, spaceId }) => {
    const { setScope } = useFileScope(spaceId);
    const { open: openShareModal } = useResourceShareModal();

    const [editing, isLoading] = useSourceSetStore((s) => [
      s.sourceSetRenamingId === id,
      s.sourceSetLoadingIds.includes(id),
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

    const handleClick = useCallback(() => {
      if (!editing) {
        setScope(buildSourceSetFileScope(id), spaceId);
      }
    }, [editing, id, setScope, spaceId]);

    const handleDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.altKey) {
          toggleEditing(true);
        }
      },
      [toggleEditing],
    );

    // Icon (show loader when updating)
    const icon = useMemo(() => {
      if (isLoading) {
        return (
          <Icon
            spin
            color={cssVar.colorTextDescription}
            icon={RESOURCE_ENTRY_ICONS.loader}
            size={18}
          />
        );
      }
      return <Icon icon={RESOURCE_ENTRY_ICONS.sourceSet} size={18} />;
    }, [isLoading]);

    const dropdownMenu = useDropdownMenu({
      description,
      id,
      name,
      onShare: () => openShareModal({ id, kind: 'source_set', name }),
      spaceId: spaceId || undefined,
      toggleEditing,
    });

    return (
      <>
        <NavItem
          actions={active ? <Actions dropdownMenu={dropdownMenu} /> : undefined}
          active={active}
          className={className}
          contextMenuItems={dropdownMenu}
          disabled={editing}
          icon={icon}
          key={id}
          loading={isLoading}
          style={style}
          title={name}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        />
        <Editing id={id} name={name} toggleEditing={toggleEditing} />
      </>
    );
  },
);

export default SourceSetItem;
