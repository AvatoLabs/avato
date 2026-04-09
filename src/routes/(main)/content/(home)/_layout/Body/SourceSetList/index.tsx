'use client';

import { Center, Flexbox, Icon, Text } from '@lobehub/ui';
import { Button } from 'antd';
import { createStaticStyles, cssVar } from 'antd-style';
import { FolderKanban, Plus } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import { useFileScope } from '@/features/ContentManager/useFileScope';
import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useSourceSetStore } from '@/store/sourceSet';

import Item from './Item';

const styles = createStaticStyles(({ css, cssVar }) => ({
  emptyAction: css`
    align-self: flex-start;
  `,
  emptyState: css`
    width: 100%;
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 16px;

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 72%, transparent);
  `,
  emptyStateBody: css`
    min-width: 0;
  `,
  emptyStateDescription: css`
    color: ${cssVar.colorTextTertiary};
    font-size: 12px;
    line-height: 1.5;
  `,
  emptyStateTitle: css`
    color: ${cssVar.colorTextSecondary};
    font-size: 14px;
    font-weight: 500;
  `,
  listShell: css`
    gap: 2px;
    padding: 4px;
    border-radius: 16px;

    background: color-mix(in srgb, ${cssVar.colorFillQuaternary} 42%, transparent);
  `,
}));

/**
 * Show library list in the sidebar
 */
const SourceSetList = memo(() => {
  const { t } = useTranslation(['file', 'sourceSet']);
  const { id: routeSourceSetId } = useParams<{ id?: string }>();
  const spaceId = useContentManagerStore((s) => s.spaceId);
  const { sourceSetId: scopedSourceSetId } = useFileScope(spaceId);
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data, isLoading } = useFetchSourceSetList(spaceId);
  const activeSourceSetId = routeSourceSetId ?? scopedSourceSetId;

  const { open } = useCreateSourceSetModal();

  const handleCreate = () => {
    open({ spaceId });
  };

  if (isLoading) return <SkeletonList avatarSize={20} paddingInline={4} rows={4} />;

  if (data?.length === 0) {
    return (
      <Center padding={8}>
        <Flexbox className={styles.emptyState} data-testid="source-set-empty-state" gap={10}>
          <Icon color={cssVar.colorTextQuaternary as string} icon={FolderKanban} size={28} />
          <Flexbox className={styles.emptyStateBody} gap={4}>
            <Text className={styles.emptyStateTitle}>
              {t('emptyState.title', { ns: 'sourceSet' })}
            </Text>
            <Text className={styles.emptyStateDescription}>
              {t('emptyState.description', { ns: 'sourceSet' })}
            </Text>
          </Flexbox>
          <Button
            className={styles.emptyAction}
            icon={<Icon icon={Plus} />}
            size="small"
            type="primary"
            onClick={handleCreate}
          >
            {t('emptyState.action', { ns: 'sourceSet' })}
          </Button>
        </Flexbox>
      </Center>
    );
  }

  return (
    <Flexbox className={styles.listShell} data-testid="source-set-list-shell">
      {data?.map((item) => (
        <Item
          active={activeSourceSetId === item.id}
          description={item.description}
          id={item.id}
          key={item.id}
          name={item.name}
          spaceId={item.spaceId}
        />
      ))}
    </Flexbox>
  );
});

export default SourceSetList;
