import { AccordionItem, ActionIcon, Text } from '@lobehub/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/resourceIcons';
import { useCreateNewModal } from '@/features/LibraryModal';
import { buildResourceLibraryPath } from '@/features/ResourceSpaces';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';

import LibraryList from './LibraryList';

const SidebarBody = memo<{ itemKey: string }>(({ itemKey }) => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const spaceId = useResourceManagerStore((s) => s.spaceId);

  const { open } = useCreateNewModal();

  const handleCreate = () => {
    open({
      onSuccess: (id) => {
        navigate(buildResourceLibraryPath(spaceId, id));
      },
      spaceId,
    });
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
          title={t('library.new')}
          onClick={handleCreate}
        />
      }
      title={
        <Text ellipsis fontSize={12} type={'secondary'} weight={500}>
          {t('library.title')}
        </Text>
      }
    >
      <LibraryList />
    </AccordionItem>
  );
});

export default SidebarBody;
