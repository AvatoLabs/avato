'use client';

import { Block, Flexbox, Tag, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQueryRoute } from '@/hooks/useQueryRoute';
import { usePathname } from '@/libs/router/navigation';

const styles = createStaticStyles(({ css, cssVar }) => ({
  description: css`
    color: ${cssVar.colorTextSecondary};
  `,
  itemCount: css`
    flex: none;
    min-width: 56px;
    text-align: end;
  `,
}));

interface InstallableFilterProps {
  active: boolean;
  count: number;
}

const InstallableFilter = memo<InstallableFilterProps>(({ active, count }) => {
  const { t } = useTranslation('discover');
  const pathname = usePathname();
  const router = useQueryRoute();

  return (
    <Flexbox gap={8} width={'100%'}>
      <Block
        clickable
        padding={14}
        variant={active ? 'filled' : 'outlined'}
        width={'100%'}
        onClick={() =>
          router.push(pathname, {
            query: {
              installable: active ? null : '1',
              page: '1',
            },
          })
        }
      >
        <Flexbox horizontal align={'center'} justify={'space-between'} width={'100%'}>
          <Text strong>{t('aggregator.filters.installable')}</Text>
          <Tag className={styles.itemCount} variant={active ? 'filled' : 'outlined'}>
            {count.toLocaleString()}
          </Tag>
        </Flexbox>
        <Text as={'p'} className={styles.description} style={{ fontSize: 12 }}>
          {t('aggregator.filters.installable.description')}
        </Text>
      </Block>
    </Flexbox>
  );
});

InstallableFilter.displayName = 'InstallableFilter';

export default InstallableFilter;
