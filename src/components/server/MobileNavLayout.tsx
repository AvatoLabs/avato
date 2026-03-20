import { type FlexboxProps } from '@lobehub/ui';
import { Flexbox } from '@lobehub/ui';
import { type CSSProperties, type ReactNode } from 'react';

import { MOBILE_TABBAR_HEIGHT } from '@/const/layoutTokens';

interface MobileContentLayoutProps extends FlexboxProps {
  header?: ReactNode;
  withNav?: boolean;
}

const getBottomPadding = (paddingBottom?: CSSProperties['paddingBottom']) => {
  if (paddingBottom === undefined || paddingBottom === null || paddingBottom === '') {
    return `calc(${MOBILE_TABBAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;
  }

  if (paddingBottom === 0) return 0;

  if (typeof paddingBottom === 'number') {
    return `calc(${paddingBottom}px + ${MOBILE_TABBAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;
  }

  return `calc(${paddingBottom} + ${MOBILE_TABBAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`;
};

const MobileContentLayout = ({
  children,
  withNav,
  style,
  header,
  id = 'lobe-mobile-scroll-container',
  ...rest
}: MobileContentLayoutProps) => {
  const contentStyle: CSSProperties = {
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehaviorY: 'contain',
    position: 'relative',
    WebkitOverflowScrolling: 'touch',
    ...style,
    paddingBottom: withNav ? getBottomPadding(style?.paddingBottom) : style?.paddingBottom,
  };

  const content = (
    <Flexbox height="100%" id={id} style={contentStyle} width="100%" {...rest}>
      {children}
    </Flexbox>
  );

  if (!header) return content;

  return (
    <Flexbox height={'100%'} style={{ overflow: 'hidden', position: 'relative' }} width={'100%'}>
      {header}
      <Flexbox height="100%" id={id} style={contentStyle} width="100%" {...rest}>
        {children}
      </Flexbox>
    </Flexbox>
  );
};

export default MobileContentLayout;
