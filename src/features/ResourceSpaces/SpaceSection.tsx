'use client';

import { AccordionItem, ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { PlusIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { buildFilesRootPath } from './paths';
import SpaceList from './SpaceList';
import { useOpenCreateSpaceModal } from './useOpenCreateSpaceModal';

const SpaceSection = memo<{ itemKey: string }>(({ itemKey }) => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const { spaceId: currentSpaceId } = useParams<{ spaceId?: string }>();
  const handleCreateSpace = useOpenCreateSpaceModal((spaceId) => {
    navigate(buildFilesRootPath(spaceId));
  });

  return (
    <AccordionItem
      itemKey={itemKey}
      paddingBlock={4}
      paddingInline={'8px 4px'}
      action={
        <ActionIcon
          icon={PlusIcon}
          size={'small'}
          title={t('space.create.title')}
          onClick={handleCreateSpace}
        />
      }
      title={
        <Text ellipsis fontSize={12} type={'secondary'} weight={500}>
          {t('space.sectionTitle')}
        </Text>
      }
    >
      <Flexbox gap={1} paddingInline={4}>
        <SpaceList
          currentSpaceId={currentSpaceId}
          onSelectSpace={(spaceId) => navigate(buildFilesRootPath(spaceId))}
        />
      </Flexbox>
    </AccordionItem>
  );
});

SpaceSection.displayName = 'SpaceSection';

export default SpaceSection;
