'use client';

import { Center, Flexbox, Icon, Text } from '@lobehub/ui';
import { Button } from 'antd';
import { cssVar } from 'antd-style';
import { FolderKanban, Plus } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import SkeletonList from '@/features/NavPanel/components/SkeletonList';
import { useCreateSourceSetModal } from '@/features/SourceSetModal';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { useSourceSetStore } from '@/store/sourceSet';

import Item from './Item';

/**
 * Show library list in the sidebar
 */
const SourceSetList = memo(() => {
  const { t } = useTranslation(['file', 'sourceSet']);
  const spaceId = useContentManagerStore((s) => s.spaceId);
  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const { data, isLoading } = useFetchSourceSetList(spaceId);

  const { open } = useCreateSourceSetModal();

  const handleCreate = () => {
    open({ spaceId });
  };

  if (isLoading) return <SkeletonList avatarSize={20} paddingInline={4} rows={4} />;

  if (data?.length === 0) {
    return (
      <Center padding={16}>
        <Flexbox align="center" gap={12} style={{ maxWidth: 200, textAlign: 'center' }}>
          <Icon color={cssVar.colorTextQuaternary as string} icon={FolderKanban} size={32} />
          <Flexbox align="center" gap={4}>
            <Text fontSize={14} style={{ color: cssVar.colorTextSecondary }}>
              {t('emptyState.title', { ns: 'sourceSet' })}
            </Text>
            <Text fontSize={12} style={{ color: cssVar.colorTextTertiary }}>
              {t('emptyState.description', { ns: 'sourceSet' })}
            </Text>
          </Flexbox>
          <Button icon={<Icon icon={Plus} />} size="small" type="primary" onClick={handleCreate}>
            {t('emptyState.action', { ns: 'sourceSet' })}
          </Button>
        </Flexbox>
      </Center>
    );
  }

  return (
    <Flexbox gap={1} paddingInline={4}>
      {data?.map((item) => (
        <Item
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
