import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    container: css`
      position: relative;
      max-width: 100%;

      time {
        pointer-events: none;

        display: inline-block;

        white-space: nowrap;

        opacity: 0.64;

        transition:
          opacity 200ms ${cssVar.motionEaseOut},
          color 200ms ${cssVar.motionEaseOut};
      }

      [data-message-actions] {
        pointer-events: auto;

        transform: translateY(2px);

        display: flex;

        opacity: 0.32;

        transition:
          opacity 200ms ${cssVar.motionEaseOut},
          transform 200ms ${cssVar.motionEaseOut};
      }

      &:focus-within,
      &:has([data-popup-open]),
      &:hover {
        time,
        [data-message-actions] {
          opacity: 1;
        }

        [data-message-actions] {
          transform: translateY(0);
        }
      }

      @media (hover: none) {
        time {
          opacity: 0.88;
        }

        [data-message-actions] {
          transform: none;
          opacity: 0.92;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        [data-message-actions] {
          transform: none;
          transition: opacity 200ms ${cssVar.motionEaseOut};
        }
      }
    `,
    loading: css`
      position: absolute;
      inset-block-end: 0;
      inset-inline-start: -8px;
      inset-inline-end: unset;

      min-width: 22px;
      height: 18px;
      padding-inline: 4px;
      border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 78%, transparent);
      border-radius: 999px;

      color: ${cssVar.colorText};

      background: linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorBgElevated} 96%, ${cssVar.colorFillQuaternary}) 0%,
        color-mix(in srgb, ${cssVar.colorFillQuaternary} 84%, ${cssVar.colorBgLayout}) 100%
      );
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, ${cssVar.colorTextLightSolid} 12%, transparent),
        0 10px 24px -18px color-mix(in srgb, ${cssVar.colorText} 24%, transparent);
    `,
  };
});
