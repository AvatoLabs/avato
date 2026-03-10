import { isDesktop } from '@lobechat/const';
import { type PropsWithChildren } from 'react';

import Desktop from './Desktop';
import NoAuth from './NoAuth';

const AuthProvider = ({ children }: PropsWithChildren) => {
  if (isDesktop) {
    return <Desktop>{children}</Desktop>;
  }

  // NoAuth mode: bypass authentication for self-hosted deployment
  return <NoAuth>{children}</NoAuth>;
};

export default AuthProvider;
