'use client';

import { Block, Flexbox, Icon, Text } from '@lobehub/ui';
import { FilesIcon, FolderOpenIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';

import { buildResourcePreviewPath } from './paths';

const FavoritesPage = memo(() => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const { data, isLoading } = useSWR(
    'resource-favorites-list',
    () => lambdaClient.favorite.listFavorites.query(),
    { revalidateOnFocus: false },
  );
  const items = (data ?? []).filter((item): item is NonNullable<typeof item> => !!item);

  if (isLoading) {
    return (
      <Flexbox align={'center'} height={'100%'} justify={'center'}>
        <Loading debugId="favorites" />
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={16} padding={24} width={'100%'}>
      <Flexbox gap={4}>
        <Text as={'h2'}>{t('favorites.title')}</Text>
        <Text type={'secondary'}>{t('favorites.subtitle')}</Text>
      </Flexbox>

      {!items.length ? (
        <Block padding={16} variant={'outlined'}>
          <Text type={'secondary'}>{t('favorites.empty')}</Text>
        </Block>
      ) : (
        <Flexbox gap={12}>
          {items.map((item) => {
            const isFolder = item.fileType === 'custom/folder';
            const icon = isFolder ? FolderOpenIcon : FilesIcon;

            const targetPath = buildResourcePreviewPath(item.spaceId, item.id);

            return (
              <Block
                clickable
                horizontal
                align={'center'}
                gap={12}
                key={item.id}
                padding={16}
                variant={'outlined'}
                onClick={() => navigate(targetPath)}
              >
                <Icon icon={icon} />
                <Flexbox flex={1} gap={2} style={{ overflow: 'hidden' }}>
                  <Text ellipsis strong>
                    {item.name}
                  </Text>
                  <Text ellipsis fontSize={12} type={'secondary'}>
                    {item.sourceType === 'document'
                      ? t('favorites.kind.document')
                      : t('favorites.kind.file')}
                  </Text>
                </Flexbox>
              </Block>
            );
          })}
        </Flexbox>
      )}
    </Flexbox>
  );
});

FavoritesPage.displayName = 'FavoritesPage';

export default FavoritesPage;
