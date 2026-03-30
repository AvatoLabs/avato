import { Center } from '@lobehub/ui';
import { createStaticStyles, keyframes } from 'antd-style';
import { type CSSProperties, memo } from 'react';

const wave = keyframes`
  0%, 80%, 100% {
    transform: translateY(0) scale(0.72);
    opacity: 0.28;
  }

  40% {
    transform: translateY(-22%) scale(1);
    opacity: 1;
  }
`;

const glow = keyframes`
  0%, 100% {
    transform: scale(0.94);
    opacity: 0.18;
  }

  50% {
    transform: scale(1.06);
    opacity: 0.38;
  }
`;

const styles = createStaticStyles(({ css }) => ({
  dot: css`
    will-change: transform, opacity;

    width: var(--dot-size);
    height: var(--dot-size);
    border-radius: 50%;

    background: currentcolor;

    animation: ${wave} 1.28s ease-in-out infinite;
  `,
  root: css`
    position: relative;

    display: inline-flex;
    gap: calc(var(--dot-size) * 0.45);
    align-items: center;
    justify-content: center;

    width: calc(var(--dot-size) * 4.6);
    height: calc(var(--dot-size) * 2.4);

    color: currentcolor;

    &::before {
      pointer-events: none;
      content: '';

      position: absolute;
      inset: calc(var(--dot-size) * -0.45);

      border-radius: 999px;

      opacity: 0.22;
      background: radial-gradient(circle, currentcolor 0%, transparent 72%);
      filter: blur(calc(var(--dot-size) * 0.55));

      animation: ${glow} 2.4s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      &::before {
        animation: none;
      }
    }
  `,
}));

interface BubblesLoadingProps {
  size?: number;
}

const BubblesLoading = memo<BubblesLoadingProps>(({ size = 6 }) => {
  return (
    <Center
      className={styles.root}
      style={
        {
          '--dot-size': `${size}px`,
        } as CSSProperties
      }
    >
      {Array.from({ length: 3 }).map((_, index) => (
        <span
          className={styles.dot}
          key={index}
          style={{
            animationDelay: `${index * 0.14}s`,
          }}
        />
      ))}
    </Center>
  );
});

export default BubblesLoading;
