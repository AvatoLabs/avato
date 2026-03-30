'use client';

import { type DropdownItem } from '@lobehub/ui';
import {
  ActionIcon,
  Block,
  Center,
  DropdownMenu,
  Icon,
  Skeleton,
  stopPropagation,
  Text,
} from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { type DragEvent } from 'react';
import { memo, useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { buildSourceSetPath } from '@/features/ResourceSpaces';
import { useDragActive } from '@/routes/(main)/content/features/DndContextWrapper';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';

const styles = createStaticStyles(({ css, cssVar }) => ({
  dropZoneActive: css`
    color: ${cssVar.colorBgElevated} !important;
    background-color: ${cssVar.colorText} !important;

    * {
      color: ${cssVar.colorBgElevated} !important;
    }
  `,
  menuIcon: css`
    color: ${cssVar.colorTextTertiary};
  `,
}));

/**
 * Quickly switch between source sets.
 */
const Head = memo(() => {
  const navigate = useNavigate();
  const { id = '' } = useParams<{ id?: string }>();
  const name = useSourceSetStore(sourceSetSelectors.getSourceSetNameById(id));
  const [setMode, setSourceSetId, spaceId] = useContentManagerStore((s) => [
    s.setMode,
    s.setSourceSetId,
    s.spaceId,
  ]);
  const isDragActive = useDragActive();
  const [isDropZoneActive, setIsDropZoneActive] = useState(false);

  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data: sourceSets } = useFetchSourceSetList(spaceId);

  const handleClick = useCallback(() => {
    setMode('explorer');
    navigate(buildSourceSetPath(spaceId, id));
  }, [id, navigate, setMode, spaceId]);

  const handleSourceSetSwitch = useCallback(
    (sourceSetId: string) => {
      setSourceSetId(sourceSetId);
      setMode('explorer');
      // Ensure navigation runs in the next event loop tick.
      setTimeout(() => {
        navigate(buildSourceSetPath(spaceId, sourceSetId));
      }, 0);
    },
    [navigate, setMode, setSourceSetId, spaceId],
  );

  // Native HTML5 drag-and-drop handlers for root directory drop
  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (!isDragActive) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDropZoneActive(true);
    },
    [isDragActive],
  );

  const handleDragLeave = useCallback(() => {
    setIsDropZoneActive(false);
  }, []);

  const handleDrop = useCallback(() => {
    setIsDropZoneActive(false);
  }, []);

  const menuItems = useMemo<DropdownItem[]>(() => {
    if (!sourceSets) return [];

    return sourceSets.map((sourceSet) => ({
      icon: (
        <Center className={styles.menuIcon} style={{ minWidth: 16 }} width={16}>
          <Icon icon={RESOURCE_ENTRY_ICONS.sourceSet} size={14} />
        </Center>
      ),
      key: sourceSet.id,
      label: sourceSet.name,
      onClick: () => handleSourceSetSwitch(sourceSet.id),
      style: sourceSet.id === id ? { backgroundColor: 'var(--ant-control-item-bg-active)' } : {},
    }));
  }, [handleSourceSetSwitch, id, sourceSets]);

  return (
    <Block
      clickable
      horizontal
      align={'center'}
      className={cx(isDropZoneActive && styles.dropZoneActive)}
      data-drop-target-id="root"
      data-is-folder="true"
      data-root-drop="true"
      gap={8}
      padding={2}
      style={{ minWidth: 32, overflow: 'hidden' }}
      variant={'borderless'}
      onClick={handleClick}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Center style={{ minWidth: 32 }} width={32}>
        <Icon icon={RESOURCE_ENTRY_ICONS.sourceSet} size={18} />
      </Center>
      {!name ? (
        <Skeleton active paragraph={false} title={{ style: { marginBottom: 0 }, width: 80 }} />
      ) : (
        <DropdownMenu items={menuItems} nativeButton={false} placement="bottomRight">
          <Center
            horizontal
            gap={4}
            style={{ cursor: 'pointer', flex: 1, overflow: 'hidden' }}
            onClick={stopPropagation}
          >
            <Text ellipsis style={{ flex: 1 }} weight={500}>
              {name}
            </Text>
            <ActionIcon
              icon={RESOURCE_ENTRY_ICONS.selector}
              style={{ width: 24 }}
              size={{
                blockSize: 28,
                size: 16,
              }}
            />
          </Center>
        </DropdownMenu>
      )}
    </Block>
  );
});

Head.displayName = 'Head';

export default Head;
