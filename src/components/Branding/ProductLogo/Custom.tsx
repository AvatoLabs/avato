'use client';

import { BRANDING_LOGO_URL, BRANDING_NAME } from '@lobechat/business-const';
import { type IconType } from '@lobehub/icons';
import { type FlexboxProps } from '@lobehub/ui';
import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { memo, type ReactNode } from 'react';

import { useIsDark } from '@/hooks/useIsDark';
import { type ImageProps } from '@/libs/next/Image';
import Image from '@/libs/next/Image';

import { type ProductLogoProps } from './types';

const styles = createStaticStyles(({ css, cssVar }) => ({
  extraTitle: css`
    font-weight: 300;
    white-space: nowrap;
  `,
  textLogoDarkPlate: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;

    padding-inline: 6px;
    border-radius: ${cssVar.borderRadiusSM};

    color: #fff;

    background: #000;
  `,
}));

const DEFAULT_LIGHT_LOGO_URL = '/icons/icon-192x192-transparent.png';
const DEFAULT_DARK_LOGO_URL = '/icons/icon-192x192-transparent-dark.png';

const CustomTextLogo = memo<FlexboxProps & { size: number }>(
  ({ size, style, className, ...rest }) => {
    const isDark = useIsDark();

    return (
      <Flexbox
        className={cx(isDark && styles.textLogoDarkPlate, className)}
        height={size}
        style={{
          fontSize: size / 1.5,
          fontWeight: 500,
          userSelect: 'none',
          ...style,
        }}
        {...rest}
      >
        {BRANDING_NAME}
      </Flexbox>
    );
  },
);

const CustomImageLogo = memo<Omit<ImageProps, 'alt' | 'src'> & { mono?: boolean; size: number }>(
  ({ size, mono, style, ...rest }) => {
    const isDark = useIsDark();
    const baseLogoUrl = BRANDING_LOGO_URL || DEFAULT_LIGHT_LOGO_URL;
    const isDefaultAvatoLogo = baseLogoUrl === DEFAULT_LIGHT_LOGO_URL;
    const logoUrl = isDefaultAvatoLogo && isDark ? DEFAULT_DARK_LOGO_URL : baseLogoUrl;

    const filter =
      !isDefaultAvatoLogo && isDark
        ? `${mono ? 'grayscale(100%) ' : ''}invert(1)`.trim()
        : mono
          ? 'grayscale(100%)'
          : undefined;

    return (
      <Image
        alt={BRANDING_NAME}
        height={size}
        src={logoUrl}
        unoptimized={true}
        width={size}
        style={{
          display: 'block',
          height: size,
          width: size,
          ...(filter ? { filter } : {}),
          ...style,
        }}
        {...rest}
      />
    );
  },
);

const Divider: IconType = (({ ref, size = '1em', style, ...rest }) => (
  <svg
    fill="none"
    height={size}
    ref={ref}
    shapeRendering="geometricPrecision"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ flex: 'none', lineHeight: 1, ...style }}
    viewBox="0 0 24 24"
    width={size}
    {...rest}
  >
    <path d="M16.88 3.549L7.12 20.451" />
  </svg>
)) as IconType;

const CustomLogo = memo<ProductLogoProps>(
  ({ extra, size = 32, className, style, type, ...rest }) => {
    let logoComponent: ReactNode;

    switch (type) {
      case '3d':
      case 'flat': {
        logoComponent = <CustomImageLogo size={size} style={style} {...rest} />;
        break;
      }
      case 'mono': {
        logoComponent = <CustomImageLogo mono size={size} style={style} {...rest} />;
        break;
      }
      case 'text': {
        logoComponent = <CustomTextLogo size={size} style={style} {...rest} />;
        break;
      }
      case 'combine': {
        logoComponent = (
          <>
            <CustomImageLogo size={size} />
            <CustomTextLogo size={size} style={{ marginLeft: Math.round(size / 4) }} />
          </>
        );

        if (!extra)
          logoComponent = (
            <Flexbox horizontal align={'center'} flex={'none'} {...rest}>
              {logoComponent}
            </Flexbox>
          );

        break;
      }
      default: {
        logoComponent = <CustomImageLogo size={size} style={style} {...rest} />;
        break;
      }
    }

    if (!extra) return logoComponent;

    const extraSize = Math.round((size / 3) * 1.9);

    return (
      <Flexbox horizontal align={'center'} className={className} flex={'none'} {...rest}>
        {logoComponent}
        <Divider size={extraSize} style={{ color: cssVar.colorFill }} />
        <div className={styles.extraTitle} style={{ fontSize: extraSize }}>
          {extra}
        </div>
      </Flexbox>
    );
  },
);

export default CustomLogo;
