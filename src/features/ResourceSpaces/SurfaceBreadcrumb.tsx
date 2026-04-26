'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { memo, type ReactNode } from 'react';

const styles = createStaticStyles(({ css, cssVar }) => ({
  breadcrumb: css`
    overflow: hidden;

    font-size: 14px;
    color: ${cssVar.colorTextSecondary};
  `,
  breadcrumbItem: css`
    overflow: hidden;
    display: inline-block;

    min-width: 0;
    max-width: 100%;

    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  clickable: css`
    cursor: pointer;
    transition: color ${cssVar.motionDurationSlow};

    &:hover {
      color: ${cssVar.colorText};
    }
  `,
  clickableButton: css`
    cursor: pointer;

    padding: 0;
    border: 0;
    background: transparent;

    font: inherit;
    line-height: inherit;
    color: inherit;

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
      border-radius: ${cssVar.borderRadiusSM}px;
    }
  `,
  currentItem: css`
    font-weight: 500;
    color: ${cssVar.colorText};
  `,
  separator: css`
    flex: none;
    margin-inline: 8px;
    color: ${cssVar.colorTextQuaternary};
  `,
}));

export interface SurfaceBreadcrumbSegment {
  current?: boolean;
  key: string;
  label: ReactNode;
  onClick?: () => void;
}

interface SurfaceBreadcrumbProps {
  segments: SurfaceBreadcrumbSegment[];
}

const SurfaceBreadcrumb = memo<SurfaceBreadcrumbProps>(({ segments }) => {
  if (segments.length === 0) return null;

  return (
    <Flexbox
      horizontal
      align={'center'}
      className={styles.breadcrumb}
      gap={0}
      style={{ minWidth: 0 }}
    >
      {segments.map((segment, index) => (
        <Flexbox horizontal align={'center'} gap={0} key={segment.key} style={{ minWidth: 0 }}>
          {index > 0 && <span className={styles.separator}>/</span>}
          {segment.onClick && !segment.current ? (
            <button
              className={cx(styles.breadcrumbItem, styles.clickable, styles.clickableButton)}
              type="button"
              onClick={segment.onClick}
            >
              {segment.label}
            </button>
          ) : (
            <span className={cx(styles.breadcrumbItem, segment.current && styles.currentItem)}>
              {segment.label}
            </span>
          )}
        </Flexbox>
      ))}
    </Flexbox>
  );
});

SurfaceBreadcrumb.displayName = 'SurfaceBreadcrumb';

export default SurfaceBreadcrumb;
