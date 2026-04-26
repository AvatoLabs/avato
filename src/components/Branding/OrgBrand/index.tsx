import { ORG_NAME } from '@lobechat/business-const';
import { type CSSProperties, memo } from 'react';

interface OrgBrandProps {
  className?: string;
  color?: string;
  size?: number | string;
  style?: CSSProperties;
}

export const OrgBrand = memo<OrgBrandProps>(({ className, color, size, style }) => (
  <span className={className} style={{ color, fontSize: size, fontWeight: 600, ...style }}>
    {ORG_NAME}
  </span>
));

OrgBrand.displayName = 'OrgBrand';
