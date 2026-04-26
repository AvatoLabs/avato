'use client';

import { memo } from 'react';

import CustomLogo from './Custom';
import { type ProductLogoProps } from './types';

export const ProductLogo = memo<ProductLogoProps>((props) => <CustomLogo {...props} />);

ProductLogo.displayName = 'ProductLogo';
