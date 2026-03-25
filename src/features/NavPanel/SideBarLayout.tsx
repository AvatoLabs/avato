'use client';

import { Flexbox, ScrollShadow, TooltipGroup } from '@lobehub/ui';
import { cx } from 'antd-style';
import { type ReactNode } from 'react';
import { memo, Suspense } from 'react';

import SkeletonList, { SkeletonItem } from '@/features/NavPanel/components/SkeletonList';
import Footer from '@/routes/(main)/home/_layout/Footer';

import { useGlassNavVisual } from './GlassNavVisualContext';
import { glassSidebarStyles } from './glassSidebar.styles';

interface SidebarLayoutProps {
  body?: ReactNode;
  footer?: ReactNode;
  header?: ReactNode;
  /** Optional block between scroll body and footer (e.g. pinned shortcuts). */
  middleFooter?: ReactNode;
}

const SideBarLayout = memo<SidebarLayoutProps>(({ header, body, footer, middleFooter }) => {
  const glass = useGlassNavVisual();
  const gap = glass ? 0 : 6;

  return (
    <Flexbox
      className={glass ? glassSidebarStyles.shell : undefined}
      gap={gap}
      style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}
    >
      {header ? (
        <>
          <Flexbox className={glass ? glassSidebarStyles.headerZone : undefined} flex={'none'}>
            <Suspense fallback={<SkeletonItem height={44} style={{ marginTop: 8 }} />}>
              {header}
            </Suspense>
          </Flexbox>
          {glass && <div aria-hidden className={glassSidebarStyles.hairlineDivider} />}
        </>
      ) : null}
      <Flexbox flex={1} style={{ minHeight: 0, overflow: 'hidden' }}>
        <ScrollShadow size={2} style={{ height: '100%', maxHeight: '100%' }}>
          <TooltipGroup>
            <Suspense fallback={<SkeletonList paddingBlock={8} />}>{body}</Suspense>
          </TooltipGroup>
        </ScrollShadow>
      </Flexbox>
      {middleFooter ? (
        <>
          {glass && <div aria-hidden className={glassSidebarStyles.hairlineDivider} />}
          <Flexbox className={cx(glass && glassSidebarStyles.middleFooterZone)} flex={'none'}>
            {middleFooter}
          </Flexbox>
        </>
      ) : null}
      {glass && <div aria-hidden className={glassSidebarStyles.hairlineDivider} />}
      <Flexbox className={glass ? glassSidebarStyles.footerZone : undefined} flex={'none'}>
        <Suspense>{footer || <Footer />}</Suspense>
      </Flexbox>
    </Flexbox>
  );
});

export default SideBarLayout;
