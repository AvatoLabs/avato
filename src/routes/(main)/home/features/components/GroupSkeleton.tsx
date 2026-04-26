'use client';

import { createStaticStyles, cx, keyframes } from 'antd-style';
import { type CSSProperties, memo } from 'react';

export type GroupSkeletonVariant = 'agent' | 'default' | 'page' | 'plugin' | 'resource';

const breathe = keyframes`
  0%, 100% {
    opacity: 0.84;
  }

  50% {
    opacity: 1;
  }
`;

const shimmer = keyframes`
  0% {
    transform: translateX(-140%);
  }

  100% {
    transform: translateX(140%);
  }
`;

const styles = createStaticStyles(({ css, cssVar }) => ({
  avatar: css`
    flex: none;
    border-radius: 12px;
  `,
  card: css`
    --skeleton-delay: 0ms;

    position: relative;

    overflow: hidden;
    display: flex;
    flex: none;
    flex-direction: column;
    gap: 10px;

    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG}px;

    background: linear-gradient(
      160deg,
      color-mix(in srgb, ${cssVar.colorBgContainer} 92%, ${cssVar.colorFillTertiary} 8%) 0%,
      ${cssVar.colorBgContainer} 100%
    );
    box-shadow: inset 0 1px 0 color-mix(in srgb, ${cssVar.colorTextLightSolid} 10%, transparent);

    animation: ${breathe} 3.2s ease-in-out infinite;
    animation-delay: var(--skeleton-delay);

    &::after {
      pointer-events: none;
      content: '';

      position: absolute;
      inset: 0;
      transform: translateX(-140%);

      background: linear-gradient(
        110deg,
        transparent 25%,
        color-mix(in srgb, ${cssVar.colorTextLightSolid} 16%, transparent) 46%,
        transparent 68%
      );

      animation: ${shimmer} 2.8s ease-in-out infinite;
      animation-delay: var(--skeleton-delay);
    }

    @media (prefers-reduced-motion: reduce) {
      animation: none;

      &::after {
        animation: none;
      }
    }
  `,
  cardBare: css`
    gap: 0;
    padding: 0;
  `,
  footerRow: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;

    margin-block-start: auto;
  `,
  line: css`
    border-radius: 999px;
    background: color-mix(
      in srgb,
      ${cssVar.colorFillSecondary} 76%,
      ${cssVar.colorBgContainer} 24%
    );
  `,
  preview: css`
    border-radius: 16px;
    background: color-mix(in srgb, ${cssVar.colorFillTertiary} 82%, ${cssVar.colorBgContainer} 18%);
  `,
  row: css`
    display: flex;
    gap: 12px;
    align-items: center;
  `,
  stacked: css`
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 8px;

    min-width: 0;
  `,
}));

interface GroupSkeletonProps {
  height?: number | string;
  rows?: number;
  variant?: GroupSkeletonVariant;
  width?: number | string;
}

const getCardStyle = (index: number, width?: number | string, height?: number | string) =>
  ({
    '--skeleton-delay': `${index * 120}ms`,
    height,
    width,
  }) as CSSProperties;

const GroupSkeleton = memo<GroupSkeletonProps>(
  ({ rows = 12, width, height, variant = 'default' }) => {
    const renderCard = (index: number) => {
      const cardStyle = getCardStyle(index, width, height);

      switch (variant) {
        case 'agent': {
          return (
            <div className={styles.card} key={index} style={cardStyle}>
              <div className={styles.preview} style={{ flex: 1, minHeight: 96 }} />
              <div className={styles.footerRow}>
                <div className={styles.stacked}>
                  <div className={styles.line} style={{ height: 14, width: '68%' }} />
                  <div className={styles.line} style={{ height: 11, width: '44%' }} />
                </div>
                <div
                  className={cx(styles.preview, styles.avatar)}
                  style={{ height: 30, width: 30 }}
                />
              </div>
            </div>
          );
        }
        case 'page': {
          return (
            <div className={cx(styles.card, styles.cardBare)} key={index} style={cardStyle}>
              <div
                className={styles.preview}
                style={{ borderRadius: '16px 16px 0 0', height: 44 }}
              />
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  flexDirection: 'column',
                  gap: 8,
                  justifyContent: 'space-between',
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: -24 }}>
                  <div
                    className={cx(styles.preview, styles.avatar)}
                    style={{ height: 30, width: 30 }}
                  />
                  <div className={styles.line} style={{ height: 14, width: '74%' }} />
                  <div className={styles.line} style={{ height: 11, width: '62%' }} />
                  <div className={styles.line} style={{ height: 11, width: '48%' }} />
                </div>
                <div className={styles.line} style={{ height: 10, width: '34%' }} />
              </div>
            </div>
          );
        }
        case 'plugin': {
          return (
            <div className={styles.card} key={index} style={cardStyle}>
              <div className={styles.row}>
                <div
                  className={cx(styles.preview, styles.avatar)}
                  style={{ height: 40, width: 40 }}
                />
                <div className={styles.stacked}>
                  <div className={styles.line} style={{ height: 13, width: '56%' }} />
                  <div className={styles.line} style={{ height: 10, width: '42%' }} />
                </div>
              </div>
            </div>
          );
        }
        case 'resource': {
          return (
            <div className={cx(styles.card, styles.cardBare)} key={index} style={cardStyle}>
              <div
                className={styles.preview}
                style={{ borderRadius: '16px 16px 0 0', height: 148 }}
              />
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  flexDirection: 'column',
                  gap: 10,
                  justifyContent: 'space-between',
                  padding: 12,
                }}
              >
                <div className={styles.line} style={{ height: 13, width: '72%' }} />
                <div className={styles.row} style={{ gap: 6 }}>
                  <div className={styles.line} style={{ height: 10, width: '30%' }} />
                  <div className={styles.line} style={{ height: 10, width: '22%' }} />
                </div>
              </div>
            </div>
          );
        }
        default: {
          return <div className={styles.card} key={index} style={cardStyle} />;
        }
      }
    };

    return Array.from({ length: rows }).map((_, index) => renderCard(index));
  },
);

GroupSkeleton.displayName = 'GroupSkeleton';

export default GroupSkeleton;
