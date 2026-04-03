'use client';

import { AccordionItem, Flexbox, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useFileScope } from '@/features/ContentManager/useFileScope';
import NavItem from '@/features/NavPanel/components/NavItem';
import { useSpaceItem } from '@/features/ResourceSpaces/useSpaceItem';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';

const FileScopeSection = memo<{ itemKey: string }>(({ itemKey }) => {
  const { t } = useTranslation(['common', 'file']);
  const { id: routeSourceSetId } = useParams<{ id?: string }>();
  const spaceId = useContentManagerStore((s) => s.spaceId);
  const { scope, setScope, sourceSetId: scopedSourceSetId } = useFileScope(spaceId);
  const { space } = useSpaceItem(spaceId);
  const activeSourceSetId = routeSourceSetId ?? scopedSourceSetId;
  const showUnassigned = scope === 'unassigned' || space?.kind === 'personal';

  return (
    <AccordionItem
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline={'8px 4px'}
      title={
        <Text ellipsis fontSize={12} type={'secondary'} weight={500}>
          {t('tab.files', { defaultValue: 'Files', ns: 'common' })}
        </Text>
      }
    >
      <Flexbox gap={1} paddingInline={4}>
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
    </AccordionItem>
  );
});

FileScopeSection.displayName = 'FileScopeSection';

export default FileScopeSection;
