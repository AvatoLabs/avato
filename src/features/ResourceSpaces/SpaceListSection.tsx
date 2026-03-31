'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { createModal } from '@lobehub/ui/base-ui';
import { createStaticStyles } from 'antd-style';
import { PlusIcon } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';

import SpaceList, { SPACE_LIST_KEY } from '@/features/ResourceSpaces/SpaceList';
import { CreateSpaceForm } from '@/features/ResourceSpaces/SpaceSection';

const styles = createStaticStyles(({ css, cssVar }) => ({
  sectionTitle: css`
    display: flex;
    align-items: center;
    justify-content: space-between;

    margin-block: 4px 2px;
    padding-inline: 8px 4px;

    font-size: 12px;
    font-weight: 500;
    color: ${cssVar.colorTextDescription};
  `,
}));

interface SpaceListSectionProps {
  currentSpaceId?: string;
  onSelectSpace: (spaceId: string) => void;
}

const SpaceListSection = memo<SpaceListSectionProps>(({ currentSpaceId, onSelectSpace }) => {
  const { t } = useTranslation('file');
  const { mutate } = useSWRConfig();

  const handleCreateSpace = useCallback(() => {
    createModal({
      children: (
        <CreateSpaceForm
          onCreated={(spaceId) => {
            void mutate(SPACE_LIST_KEY);
            onSelectSpace(spaceId);
          }}
        />
      ),
      footer: null,
      title: t('space.create.title'),
      width: 420,
    });
  }, [mutate, onSelectSpace, t]);

  return (
    <Flexbox gap={4} paddingInline={4}>
      <div className={styles.sectionTitle}>
        <Text fontSize={12} type={'secondary'} weight={500}>
          {t('space.sectionTitle')}
        </Text>
        <ActionIcon
          icon={PlusIcon}
          size={'small'}
          title={t('space.create.title')}
          onClick={handleCreateSpace}
        />
      </div>
      <SpaceList currentSpaceId={currentSpaceId} onSelectSpace={onSelectSpace} />
    </Flexbox>
  );
});

SpaceListSection.displayName = 'SpaceListSection';

export default SpaceListSection;
