'use client';

import { Flexbox, Icon, Text } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { PlusIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/resourceIcons';
import { useCreateNewModal } from '@/features/LibraryModal';
import { buildResourceLibraryPath } from '@/features/ResourceSpaces';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { useKnowledgeBaseStore } from '@/store/library';

const styles = createStaticStyles(({ css }) => ({
  card: css`
    cursor: pointer;

    flex-shrink: 0;

    min-width: 120px;
    padding-block: 12px;
    padding-inline: 16px;
    border-radius: 12px;

    background: ${cssVar.colorFillTertiary};

    transition: background 0.2s;

    &:active {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  createCard: css`
    border: 1px dashed ${cssVar.colorBorder};
  `,
  list: css`
    overflow-x: auto;
    padding-inline: 12px;

    -webkit-overflow-scrolling: touch;

    &::-webkit-scrollbar {
      display: none;
    }
  `,
  sectionTitle: css`
    margin-block-end: 8px;
    padding-inline: 12px;
  `,
}));

/**
 * Horizontal library list for mobile space home.
 * Renders when on mobile, not in a library, and space has libraries.
 */
const LibraryListSection = memo(() => {
  const { t } = useTranslation(['file', 'components']);
  const navigate = useNavigate();
  const spaceId = useResourceManagerStore((s) => s.spaceId);

  const useFetchKnowledgeBaseList = useKnowledgeBaseStore((s) => s.useFetchKnowledgeBaseList);
  const { data: libraries, isLoading } = useFetchKnowledgeBaseList(spaceId);

  const { open } = useCreateNewModal();

  const handleCreate = () => {
    open({
      onSuccess: (id) => navigate(buildResourceLibraryPath(spaceId, id)),
      spaceId,
    });
  };

  if (isLoading || !libraries?.length) {
    return (
      <Flexbox gap={8} paddingBlock={12} style={{ flexShrink: 0 }}>
        <Text className={styles.sectionTitle} fontSize={14} type="secondary" weight={500}>
          {t('library.title')}
        </Text>
        <Flexbox horizontal className={styles.list} gap={12}>
          <Flexbox
            align="center"
            className={`${styles.card} ${styles.createCard}`}
            gap={8}
            justify="center"
            onClick={handleCreate}
          >
            <Icon icon={PlusIcon} size={20} />
            <Text fontSize={14}>{t('library.new')}</Text>
          </Flexbox>
        </Flexbox>
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={8} paddingBlock={12} style={{ flexShrink: 0 }}>
      <Text className={styles.sectionTitle} fontSize={14} type="secondary" weight={500}>
        {t('library.title')}
      </Text>
      <Flexbox horizontal className={styles.list} gap={12}>
        {libraries.map((lib) => (
          <Flexbox
            align="center"
            className={styles.card}
            gap={10}
            key={lib.id}
            onClick={() => navigate(buildResourceLibraryPath(lib.spaceId ?? spaceId, lib.id))}
          >
            <Icon icon={RESOURCE_ENTRY_ICONS.library} size={20} />
            <Text ellipsis fontSize={14} style={{ maxWidth: 100 }}>
              {lib.name}
            </Text>
          </Flexbox>
        ))}
        <Flexbox
          align="center"
          className={`${styles.card} ${styles.createCard}`}
          gap={8}
          justify="center"
          onClick={handleCreate}
        >
          <Icon icon={PlusIcon} size={20} />
          <Text fontSize={14}>{t('library.new')}</Text>
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

LibraryListSection.displayName = 'LibraryListSection';

export default LibraryListSection;
