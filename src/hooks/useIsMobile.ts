import { useResponsive } from 'antd-style';
import { useMemo } from 'react';

import { type SPAServerConfig } from '@/types/spaServerConfig';

/** Align with `SPAGlobalProvider`: prefer live viewport breakpoint, else build / server mobile flag. */
function getBuildVariantIsMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const serverConfig = window.__SERVER_CONFIG__ as SPAServerConfig | undefined;
  return serverConfig?.isMobile ?? (typeof __MOBILE__ !== 'undefined' ? __MOBILE__ : false);
}

export const useIsMobile = (): boolean => {
  const { mobile } = useResponsive();

  return useMemo(
    () => (typeof mobile === 'boolean' ? mobile : getBuildVariantIsMobile()),
    [mobile],
  );
};
