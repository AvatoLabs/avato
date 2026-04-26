'use client';

import { Flexbox, ScrollShadow } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { memo, Suspense } from 'react';

import NavHeader from '@/features/NavHeader';
import WideScreenButton from '@/features/WideScreenContainer/WideScreenButton';

import HeaderSummary from './HeaderSummary';
import ShareButton from './ShareButton';
import Tags from './Tags';

const styles = createStaticStyles(({ css, cssVar }) => ({
  metaRail: css`
    overflow: hidden;
    padding-block-end: 6px;
    padding-inline: 8px;
    border-block-end: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
  `,
}));

const Header = memo(() => {
  return (
    <Flexbox gap={2}>
      <NavHeader
        left={<HeaderSummary />}
        right={
          <Flexbox horizontal style={{ backgroundColor: cssVar.colorBgContainer }}>
            <WideScreenButton />
            <Suspense>
              <ShareButton />
            </Suspense>
          </Flexbox>
        }
      />
      <div className={styles.metaRail}>
        <ScrollShadow hideScrollBar offset={12} orientation={'horizontal'} size={12}>
          <Flexbox horizontal align={'center'} gap={6} style={{ minWidth: 'max-content' }}>
            <Tags />
          </Flexbox>
        </ScrollShadow>
      </div>
    </Flexbox>
  );
});

export default Header;
