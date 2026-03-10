import { isDesktop } from '@lobechat/const';
import { type PropsWithChildren } from 'react';

import BetterAuth from './BetterAuth';
import Desktop from './Desktop';
import NoAuth from './NoAuth';

const AuthProvider = ({ children }: PropsWithChildren) => {
  if (isDesktop) {
    return <Desktop>{children}</Desktop>;
  }

  // NoAuth mode: skip Better Auth entirely for self-hosted deployments
  if (process.env.NEXT_PUBLIC_NOAUTH_MODE === '1') {
    return <NoAuth>{children}</NoAuth>;
  }

  // In SPA/Vite mode, always use BetterAuth.
  // If auth is not configured on the server, useSession() will return no session
  // and the user will be treated as not signed in — same effect as NoAuth.
  return <BetterAuth>{children}</BetterAuth>;
};

export default AuthProvider;
