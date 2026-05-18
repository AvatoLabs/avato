'use client';

import { AccordionItem, ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useFileScope } from '@/features/ContentManager/useFileScope';
import NavItem from '@/features/NavPanel/components/NavItem';
import { useSpaceItem } from '@/features/ResourceSpaces/useSpaceItem';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';

import SourceSetList from './Body/SourceSetList';

/**
 * Unified Files & Collections navigation section.
 * Merges the former FileScopeSection (All Files / Unassigned) with
 * the SourceSetList into a single accordion item, giving users one
 * consistent navigation tree instead of two separate sections.
 */
const FilesSection = memo<{ itemKey: string }>(({ itemKey }) => {
  const { t } = useTranslation(['common', 'file']);
  const spaceId = useContentManagerStore((s) => s.spaceId);
  const { scope, setScope, sourceSetId: activeSourceSetId } = useFileScope(spaceId);
  const { space } = useSpaceItem(spaceId);
  const showUnassigned = scope === 'unassigned' || space?.kind === 'personal';

  const { open } = useCreateSourceSetModal();

  const handleCreate = () => {
    open({ spaceId });
  };

  return (
    <AccordionItem
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline={'8px 4px'}
      action={
        <ActionIcon
          icon={RESOURCE_ENTRY_ICONS.plus}
          size={'small'}
          title={t('collection.new', { defaultValue: 'New Collection' })}
          onClick={handleCreate}
        />
      }
      title={
        <Text ellipsis fontSize={12} type={'secondary'} weight={500}>
          {t('tab.files', { defaultValue: 'Files', ns: 'common' })}
        </Text>
      }
    >
      <Flexbox gap={1} paddingInline={4}>
        {/* Scope filters */}
        <NavItem
          active={!activeSourceSetId && scope === 'all'}
          icon={RESOURCE_ENTRY_ICONS.all}
          title={t('fileScope.all', { defaultValue: 'All Files', ns: 'file' })}
          onClick={() => setScope('all')}
        />
        {showUnassigned && (
          <NavItem
            active={!activeSourceSetId && scope === 'unassigned'}
            icon={RESOURCE_ENTRY_ICONS.folder}
            title={t('fileScope.unassigned', { defaultValue: 'Unassigned', ns: 'file' })}
            onClick={() => setScope('unassigned')}
          />
        )}
      </Flexbox>
      {/* Collection list — appears inline under the same section */}
      <SourceSetList />
    </AccordionItem>
  );
});

FilesSection.displayName = 'FilesSection';

export default FilesSection;
