'use client';

import { ORG_NAME, UTM_SOURCE } from '@lobechat/business-const';
import { OFFICIAL_URL } from '@lobechat/const';
import { type FlexboxProps } from '@lobehub/ui';
import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import { ProductLogo } from '@/components/Branding';
import { isCustomORG } from '@/const/version';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    color: ${cssVar.colorTextDescription};
  `,
  label: css`
    font-size: 10px;
    font-weight: 500;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.14em;

    opacity: 0.72;
  `,
  line: css`
    flex: none;

    width: 16px;
    height: 1px;
    border-radius: 999px;

    background: color-mix(in srgb, ${cssVar.colorTextDescription} 30%, transparent);
  `,
  logoLink: css`
    display: inline-flex;
    align-items: center;

    line-height: 1;
    color: inherit;

    opacity: 0.88;

    transition:
      color 160ms ease,
      opacity 160ms ease;

    &:hover {
      color: ${cssVar.colorLink};
      opacity: 1;
    }
  `,
  mark: css`
    flex: none;

    width: 6px;
    height: 6px;
    border-radius: 999px;

    background: color-mix(in srgb, ${cssVar.colorPrimary} 36%, ${cssVar.colorFillSecondary});
    box-shadow: 0 0 0 4px color-mix(in srgb, ${cssVar.colorPrimary} 8%, transparent);
  `,
  org: css`
    font-size: 12px;
    font-weight: 500;
    line-height: 1;
    opacity: 0.9;
  `,
}));

const BrandWatermark = memo<Omit<FlexboxProps, 'children'>>(({ style, ...rest }) => {
  return (
    <Flexbox
      horizontal
      align={'center'}
      className={styles.container}
      dir={'ltr'}
      flex={'none'}
      gap={8}
      style={style}
      {...rest}
    >
      <div className={styles.line} />
      <span className={styles.label}>Powered by</span>
      <div className={styles.mark} />
      {isCustomORG ? (
        <span className={styles.org}>{ORG_NAME}</span>
      ) : (
        <a
          className={styles.logoLink}
          href={`${OFFICIAL_URL}?utm_source=${UTM_SOURCE}&utm_content=brand_watermark`}
          rel="noreferrer"
          target="_blank"
        >
          <ProductLogo size={18} type={'text'} />
        </a>
      )}
    </Flexbox>
  );
});

export default BrandWatermark;
