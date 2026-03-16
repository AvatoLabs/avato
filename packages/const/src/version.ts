import { BRANDING_NAME, ORG_NAME } from '@lobechat/business-const';

import pkg from '../../../package.json';

export const CURRENT_VERSION = pkg.version;

export const isDesktop = typeof __ELECTRON__ !== 'undefined' && !!__ELECTRON__;

const DEFAULT_BRANDING_NAME = 'LobeChat';
const DEFAULT_ORG_NAME = 'LobeHub';

export const isCustomBranding = BRANDING_NAME !== DEFAULT_BRANDING_NAME;
export const isCustomORG = ORG_NAME !== DEFAULT_ORG_NAME;
