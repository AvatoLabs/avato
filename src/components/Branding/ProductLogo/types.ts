import { type DivProps } from '@lobehub/ui';
import { type ReactNode } from 'react';

export interface ProductLogoProps extends DivProps {
  extra?: ReactNode;
  height?: number;
  size?: number;
  type?: '3d' | 'flat' | 'mono' | 'text' | 'combine';
  width?: number;
}
