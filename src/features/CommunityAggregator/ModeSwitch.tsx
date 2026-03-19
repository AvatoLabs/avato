'use client';

import { Segmented } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { useQueryRoute } from '@/hooks/useQueryRoute';
import { usePathname } from '@/libs/router/navigation';
import { AggregatorKind } from '@/types/aggregator';

const styles = createStaticStyles(({ css }) => ({
  root: css`
    width: fit-content;
  `,
}));

interface ModeSwitchProps {
  activeKind: AggregatorKind;
}

const ModeSwitch = memo<ModeSwitchProps>(({ activeKind }) => {
  const { t } = useTranslation('discover');
  const pathname = usePathname();
  const router = useQueryRoute();

  return (
    <Segmented
      block
      className={styles.root}
      value={activeKind}
      variant={'filled'}
      options={[
        {
          label: t('aggregator.modes.mcp'),
          value: AggregatorKind.Mcp,
        },
        {
          label: t('aggregator.modes.skills'),
          value: AggregatorKind.Skills,
        },
      ]}
      onChange={(value) =>
        router.push(pathname, {
          query: {
            kind: value === AggregatorKind.Mcp ? null : String(value),
            page: '1',
            sort: null,
            source: null,
          },
        })
      }
    />
  );
});

ModeSwitch.displayName = 'ModeSwitch';

export default ModeSwitch;
