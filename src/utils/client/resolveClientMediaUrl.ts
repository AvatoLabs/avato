import { isDesktop } from '@lobechat/const';

import { withElectronProtocolIfElectron } from '@/const/protocol';

/**
 * Electron renderer must load authenticated `/f/:id` through `lobe-backend://`
 * (same pattern as tRPC). Relative `/f/` on file:// / custom scheme would not reach the API.
 */
export const resolveClientMediaUrl = (url: string): string => {
  if (isDesktop && url.startsWith('/f/')) {
    return withElectronProtocolIfElectron(url);
  }
  return url;
};
