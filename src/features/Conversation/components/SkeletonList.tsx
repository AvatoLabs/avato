'use client';

import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cx, keyframes } from 'antd-style';
import { memo } from 'react';

import WideScreenContainer from '../../WideScreenContainer';

const shimmer = keyframes`
  0% {
    transform: translateX(100%);
  }

  100% {
    transform: translateX(-100%);
  }
`;

const styles = createStaticStyles(({ css, cssVar }) => {
  const surface = css`
    position: relative;

    overflow: hidden;

    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);

    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorBgElevated} 96%, ${cssVar.colorFillQuaternary}) 0%,
      color-mix(in srgb, ${cssVar.colorFillQuaternary} 82%, ${cssVar.colorBgContainer}) 100%
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${cssVar.colorTextLightSolid} 12%, transparent),
      0 24px 40px -34px color-mix(in srgb, ${cssVar.colorText} 22%, transparent);

    &::after {
      content: '';

      position: absolute;
      inset: 0;

      background: linear-gradient(
        90deg,
        transparent 0%,
        color-mix(in srgb, ${cssVar.colorTextLightSolid} 16%, transparent) 50%,
        transparent 100%
      );

      animation: ${shimmer} 1.8s ${cssVar.motionEaseOut} infinite;
    }
  `;

  return {
    avatar: cx(
      surface,
      css`
        width: 28px;
        height: 28px;
        border-radius: 10px;
      `,
    ),
    bubble: cx(
      surface,
      css`
        width: min(72%, 560px);
        min-height: 84px;
        border-radius: 22px 22px 10px;
      `,
    ),
    line: cx(
      surface,
      css`
        height: 12px;
        border-radius: 999px;
      `,
    ),
    panel: cx(
      surface,
      css`
        padding: 16px;
        border-radius: 24px;
      `,
    ),
    pill: cx(
      surface,
      css`
        height: 26px;
        border-radius: 999px;
      `,
    ),
    shell: css`
      margin-block-start: 20px;
      padding-block: 8px 28px;
    `,
    userMeta: css`
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-block-start: 12px;
    `,
  };
});

const SkeletonList = memo(() => {
  return (
    <WideScreenContainer className={styles.shell} flex={1} gap={28} height={'100%'} padding={12}>
      <Flexbox align={'flex-end'} gap={0} width={'100%'}>
        <div className={styles.bubble} />
        <div className={styles.userMeta}>
          <div className={cx(styles.pill)} style={{ width: 74 }} />
        </div>
      </Flexbox>

      <div
        style={{
          alignItems: 'start',
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '28px minmax(0, 1fr)',
          width: '100%',
        }}
      >
        <div className={styles.avatar} />
        <div className={styles.panel}>
          <Flexbox gap={10}>
            <div className={styles.line} style={{ width: '72%' }} />
            <div className={styles.line} style={{ width: '94%' }} />
            <div className={styles.line} style={{ width: '58%' }} />
          </Flexbox>
          <div style={{ display: 'flex', gap: 8, marginBlockStart: 14 }}>
            <div className={styles.pill} style={{ width: 116 }} />
            <div className={styles.pill} style={{ width: 78 }} />
          </div>
        </div>
      </div>

      <div
        style={{
          alignItems: 'start',
          display: 'grid',
          gap: 12,
          gridTemplateColumns: '28px minmax(0, 1fr)',
          width: '100%',
        }}
      >
        <div className={styles.avatar} />
        <div className={styles.panel}>
          <Flexbox gap={10}>
            <div className={styles.line} style={{ width: '52%' }} />
            <div className={styles.line} style={{ width: '88%' }} />
            <div className={styles.line} style={{ width: '81%' }} />
            <div className={styles.line} style={{ width: '46%' }} />
          </Flexbox>
          <div style={{ display: 'flex', gap: 8, marginBlockStart: 14 }}>
            <div className={styles.pill} style={{ width: 98 }} />
            <div className={styles.pill} style={{ width: 124 }} />
          </div>
        </div>
      </div>
    </WideScreenContainer>
  );
});

export default SkeletonList;
