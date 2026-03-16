import { isDesktop } from '@lobechat/const';
import { type PropsWithChildren } from 'react';

import Desktop from './Desktop';
import NoAuth from './NoAuth';

const isNoAuthMode = process.env.NEXT_PUBLIC_NOAUTH_MODE === '1';

const AuthProvider = ({ children }: PropsWithChildren) => {
  if (isDesktop) {
    return <Desktop>{children}</Desktop>;
  }

  if (isNoAuthMode) {
    return <NoAuth>{children}</NoAuth>;
  }

  return <>{children}</>;
};

export default AuthProvider;
