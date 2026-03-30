'use client';

import { usePathname } from '@/libs/router/navigation';
import { getPageKindFromPathname } from '@/utils/docs';

export const usePageKind = () => {
  const pathname = usePathname();

  return getPageKindFromPathname(pathname);
};
