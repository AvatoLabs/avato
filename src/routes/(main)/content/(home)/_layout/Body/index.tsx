import { AccordionItem, ActionIcon, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';

import SourceSetList from './SourceSetList';

const SidebarBody = memo<{ itemKey: string }>(({ itemKey }) => {
  const { t } = useTranslation('file');
  const spaceId = useContentManagerStore((s) => s.spaceId);

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
          title={t('collection.new', { defaultValue: 'New Source Set' })}
          onClick={handleCreate}
        />
      }
      title={
        <Text ellipsis fontSize={12} type={'secondary'} weight={500}>
          {t('collection.title', { defaultValue: 'Source Sets' })}
        </Text>
      }
    >
      <SourceSetList />
    </AccordionItem>
  );
});

export default SidebarBody;
