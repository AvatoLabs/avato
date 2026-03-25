'use client';

import { BRANDING_LOGO_URL, BRANDING_NAME } from '@lobechat/business-const';
import { type IconType } from '@lobehub/icons';
import { type FlexboxProps } from '@lobehub/ui';
import { Flexbox } from '@lobehub/ui';
import { type LobeChatProps } from '@lobehub/ui/brand';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { type ReactNode } from 'react';
import { memo } from 'react';

import { useIsDark } from '@/hooks/useIsDark';
import { type ImageProps } from '@/libs/next/Image';
import Image from '@/libs/next/Image';

const styles = createStaticStyles(({ css, cssVar }) => ({
  extraTitle: css`
    font-weight: 300;
    white-space: nowrap;
  `,
  /** Dark mode: black tile + inverted asset → white mark on #000 */
  logoDarkPlate: css`
    overflow: hidden;
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;

    border-radius: ${cssVar.borderRadiusSM};

    background: #000;
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

    const filter = isDark
      ? `${mono ? 'grayscale(100%) ' : ''}invert(1)`.trim()
      : mono
        ? 'grayscale(100%)'
        : undefined;

    const img = (
      <Image
        alt={BRANDING_NAME}
        height={size}
        src={BRANDING_LOGO_URL}
        unoptimized={true}
        width={size}
        style={{
          display: 'block',
          width: size,
          height: size,
          ...(filter ? { filter } : {}),
          ...style,
        }}
        {...rest}
      />
    );

    if (!isDark) return img;

    return (
      <span className={styles.logoDarkPlate} style={{ height: size, width: size }}>
        {img}
      </span>
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

const CustomLogo = memo<LobeChatProps>(({ extra, size = 32, className, style, type, ...rest }) => {
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
});

export default CustomLogo;
