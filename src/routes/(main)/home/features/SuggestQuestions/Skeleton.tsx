'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, keyframes } from 'antd-style';
import { type CSSProperties, memo } from 'react';

const shimmer = keyframes`
  0% {
    transform: translateX(-140%);
  }

  100% {
    transform: translateX(140%);
  }
`;

const styles = createStaticStyles(({ css, cssVar }) => ({
  card: css`
    --skeleton-delay: 0ms;

    position: relative;

    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 10px;

    padding-block: 12px;
    padding-inline: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG}px;

    background: color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorFillTertiary} 8%);

    &::after {
      pointer-events: none;
      content: '';

      position: absolute;
      inset: 0;
      transform: translateX(-140%);

      background: linear-gradient(
        110deg,
        transparent 24%,
        color-mix(in srgb, ${cssVar.colorTextLightSolid} 14%, transparent) 48%,
        transparent 72%
      );

      animation: ${shimmer} 2.6s ease-in-out infinite;
      animation-delay: var(--skeleton-delay);
    }

    @media (prefers-reduced-motion: reduce) {
      &::after {
        animation: none;
      }
    }
  `,
  grid: css`
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;

    @media (width <= 768px) {
      grid-template-columns: 1fr;
    }
  `,
  line: css`
    border-radius: 999px;
    background: color-mix(
      in srgb,
      ${cssVar.colorFillSecondary} 76%,
      ${cssVar.colorBgContainer} 24%
    );
  `,
  row: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;
  `,
}));

const getCardStyle = (index: number) =>
  ({
    '--skeleton-delay': `${index * 120}ms`,
  }) as CSSProperties;

const SuggestQuestionsSkeleton = memo(() => {
  return (
    <Flexbox className={styles.grid}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div className={styles.card} key={index} style={getCardStyle(index)}>
          <div className={styles.row}>
            <div className={styles.line} style={{ height: 14, width: '54%' }} />
            <div className={styles.line} style={{ height: 14, width: 14 }} />
          </div>
          <div className={styles.line} style={{ height: 11, width: '84%' }} />
          <div className={styles.line} style={{ height: 11, width: '66%' }} />
        </div>
      ))}
    </Flexbox>
  );
});

SuggestQuestionsSkeleton.displayName = 'SuggestQuestionsSkeleton';

export default SuggestQuestionsSkeleton;
