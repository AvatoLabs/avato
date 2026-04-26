'use client';

import { INBOX_SESSION_ID } from '@lobechat/const';
import { lazy, memo, Suspense, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isDesktop } from '@/const/version';
import { useIsMobile } from '@/hooks/useIsMobile';
import { getDesktopOnboardingCompleted } from '@/routes/(desktop)/desktop-onboarding/storage';
import { useAgentStore } from '@/store/agent/store';
import { useGlobalStore } from '@/store/global';
import { useServerConfigStore, useServerConfigStoreApi } from '@/store/serverConfig';
import { serverConfigSelectors } from '@/store/serverConfig/selectors';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';

import { useUserStateRedirect } from './useUserStateRedirect';

const DeferredStoreInitialization = lazy(() => import('./DeferredStoreInitialization'));

const requestDeferredInitialization = (onReady: () => void) => {
  if (typeof window === 'undefined') return () => {};

  const win = window as Window &
    typeof globalThis & {
      cancelIdleCallback?: (id: number) => void;
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
    };

  if (typeof win.requestIdleCallback === 'function') {
    const id = win.requestIdleCallback(() => onReady(), { timeout: 1500 });

    return () => win.cancelIdleCallback?.(id);
  }

  const timeoutId = win.setTimeout(onReady, 300);
  return () => win.clearTimeout(timeoutId);
};

const StoreInitialization = memo(() => {
  // prefetch error ns to avoid don't show error content correctly
  useTranslation('error');
  const [shouldInitDeferred, setShouldInitDeferred] = useState(false);

  const [isLogin, useInitUserState] = useUserStore((s) => [
    authSelectors.isLogin(s),
    s.useInitUserState,
  ]);

  const serverConfig = useServerConfigStore((s) => s.serverConfig);
  const serverConfigStoreApi = useServerConfigStoreApi();

  const [useInitSystemStatus, useCheckServerVersion] = useGlobalStore((s) => [
    s.useInitSystemStatus,
    s.useCheckServerVersion,
  ]);

  const useInitBuiltinAgent = useAgentStore((s) => s.useInitBuiltinAgent);

  // init the system preference
  useInitSystemStatus();

  // check server version in desktop app
  useCheckServerVersion();

  // fetch server config
  const useFetchServerConfig = useServerConfigStore((s) => s.useInitServerConfig);
  useFetchServerConfig();

  const oAuthSSOProviders = useServerConfigStore(serverConfigSelectors.oAuthSSOProviders);

  /**
   * The store function of `isLogin` will both consider the values of `enableAuth` and `isSignedIn`.
   * But during initialization, the value of `enableAuth` might be incorrect cause of the async fetch.
   * So we need to use `isSignedIn` only to determine whether request for the default agent config and user state.
   *
   * IMPORTANT: Explicitly convert to boolean to avoid passing null/undefined downstream,
   * which would cause unnecessary API requests with invalid login state.
   */
  const isLoginOnInit = Boolean(isLogin);

  // init inbox agent via builtin agent mechanism
  useInitBuiltinAgent(INBOX_SESSION_ID, { isLogin: isLoginOnInit });

  const onUserStateSuccess = useUserStateRedirect();

  // Desktop onboarding redirect: must run on mount, independent of API success,
  // because the API call itself will 401 when not authenticated.
  useEffect(() => {
    if (isDesktop && !getDesktopOnboardingCompleted()) {
      const { pathname } = window.location;
      if (!pathname.startsWith('/desktop-onboarding')) {
        window.location.href = '/desktop-onboarding';
      }
    }
  }, []);

  // init user state
  useInitUserState(isLoginOnInit, serverConfig, {
    onSuccess: onUserStateSuccess,
  });

  const mobile = useIsMobile();

  useEffect(() => {
    if (typeof oAuthSSOProviders === 'undefined') return;

    useUserStore.setState({ oAuthSSOProviders });
  }, [oAuthSSOProviders]);

  useEffect(() => {
    useGlobalStore.setState({ isMobile: mobile });
    serverConfigStoreApi.setState({ isMobile: mobile });
  }, [mobile, serverConfigStoreApi]);

  useEffect(() => requestDeferredInitialization(() => setShouldInitDeferred(true)), []);

  return (
    <Suspense>
      {shouldInitDeferred && <DeferredStoreInitialization isLogin={isLoginOnInit} />}
    </Suspense>
  );
});

export default StoreInitialization;
