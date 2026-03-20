import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  action: css`
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 70%, transparent);
    background: color-mix(in srgb, ${cssVar.colorFillSecondary} 88%, transparent);
    box-shadow: 0 4px 14px rgb(0 0 0 / 4%);
  `,
  brand: css`
    opacity: 0.96;
  `,
  leftContainer: css`
    margin-inline-start: 8px;
  `,
}));
