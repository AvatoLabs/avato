'use client';

import { Block, Flexbox, Icon, Text } from '@lobehub/ui';
import { FilesIcon, FolderOpenIcon, LibraryIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { lambdaClient } from '@/libs/trpc/client';

import { buildResourceLibraryPath, buildResourcePreviewPath } from './paths';

const SharedWithMePage = memo(() => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const { data, isLoading } = useSWR(
    'resource-shared-with-me',
    () => lambdaClient.resourceShare.listSharedWithMe.query(),
    { revalidateOnFocus: false },
  );
  const items = (data ?? []).filter((item): item is NonNullable<typeof item> => !!item);

  if (isLoading) {
    return (
      <Flexbox align={'center'} height={'100%'} justify={'center'}>
        <Loading debugId="shared-with-me" />
      </Flexbox>
    );
  }

  return (
    <Flexbox gap={16} padding={24} width={'100%'}>
      <Flexbox gap={4}>
        <Text as={'h2'}>{t('shared.title')}</Text>
        <Text type={'secondary'}>{t('shared.subtitle')}</Text>
      </Flexbox>

      {!items.length ? (
        <Block padding={16} variant={'outlined'}>
          <Text type={'secondary'}>{t('shared.empty')}</Text>
        </Block>
      ) : (
        <Flexbox gap={12}>
          {items.map((item) => {
            const icon =
              item.kind === 'knowledge_base'
                ? LibraryIcon
                : item.kind === 'document'
                  ? FolderOpenIcon
                  : FilesIcon;

            const targetPath =
              item.kind === 'knowledge_base'
                ? buildResourceLibraryPath(item.spaceId, item.localId)
                : buildResourcePreviewPath(item.spaceId, item.localId);

            return (
              <Block
                clickable
                horizontal
                align={'center'}
                gap={12}
                key={item.resourceUid}
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
                    {t(`shared.kind.${item.kind}`)}
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

SharedWithMePage.displayName = 'SharedWithMePage';

export default SharedWithMePage;
