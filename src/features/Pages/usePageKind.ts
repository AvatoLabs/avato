'use client';

import { usePathname } from '@/libs/router/navigation';
import { getPageKindFromPathname } from '@/utils/page';

export const usePageKind = () => {
  const pathname = usePathname();

  return getPageKindFromPathname(pathname);
};
