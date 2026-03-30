import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  action: css`
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 70%, transparent);
    background: color-mix(in srgb, ${cssVar.colorFillSecondary} 88%, transparent);
    box-shadow: 0 4px 14px rgb(0 0 0 / 4%);
  `,
  brand: css`
    min-width: 0;
    opacity: 0.96;
  `,
  brandMeta: css`
    min-width: 0;
  `,
  brandSubtitle: css`
    font-size: 11px;
    line-height: 1.2;
    color: ${cssVar.colorTextDescription};
  `,
  leftContainer: css`
    min-width: 0;
    margin-inline-start: 8px;
  `,
}));
