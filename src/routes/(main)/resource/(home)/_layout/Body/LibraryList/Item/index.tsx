import { Icon } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { Loader2Icon } from 'lucide-react';
import { type CSSProperties } from 'react';
import React, { memo, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import RepoIcon from '@/components/LibIcon';
import NavItem from '@/features/NavPanel/components/NavItem';
import { useResourceShareModal } from '@/features/ResourceSharing';
import { buildResourceLibraryPath } from '@/features/ResourceSpaces';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { useKnowledgeBaseStore } from '@/store/library';

import Actions from './Actions';
import Editing from './Editing';
import { useDropdownMenu } from './useDropdownMenu';

interface KnowledgeBaseItemProps {
  active?: boolean;
  className?: string;
  description?: string | null;
  id: string;
  name: string;
  spaceId?: string | null;
  style?: CSSProperties;
}

const KnowledgeBaseItem = memo<KnowledgeBaseItemProps>(
  ({ id, name, description, active, style, className, spaceId }) => {
    const setLibraryId = useResourceManagerStore((s) => s.setLibraryId);
    const navigate = useNavigate();
    const { open: openShareModal } = useResourceShareModal();

    const [editing, isLoading] = useKnowledgeBaseStore((s) => [
      s.knowledgeBaseRenamingId === id,
      s.knowledgeBaseLoadingIds.includes(id),
    ]);

    const toggleEditing = useCallback(
      (visible?: boolean) => {
        useKnowledgeBaseStore.setState(
          { knowledgeBaseRenamingId: visible ? id : null },
          false,
          'toggleEditing',
        );
      },
      [id],
    );

    const handleClick = useCallback(() => {
      if (!editing) {
        navigate(buildResourceLibraryPath(spaceId, id));
        setLibraryId(id);
      }
    }, [editing, navigate, id, setLibraryId, spaceId]);

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
        return <Icon spin color={cssVar.colorTextDescription} icon={Loader2Icon} size={18} />;
      }
      return <RepoIcon size={18} />;
    }, [isLoading]);

    const dropdownMenu = useDropdownMenu({
      description,
      id,
      name,
      onShare: () => openShareModal({ id, kind: 'knowledge_base', name }),
      spaceId: spaceId || undefined,
      toggleEditing,
    });

    return (
      <>
        <NavItem
          actions={<Actions dropdownMenu={dropdownMenu} />}
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

export default KnowledgeBaseItem;
