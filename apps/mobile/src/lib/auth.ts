import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { NativeModules, Platform } from 'react-native';

import { normalizeApiUrl } from './server';

WebBrowser.maybeCompleteAuthSession();

const AUTH_SESSION_STORAGE_KEY = 'avato_oidc_session';
const MOBILE_CLIENT_ID = 'lobehub-mobile';
const MOBILE_AUTH_SCHEME = 'com.avato.app';
const MOBILE_AUTH_CALLBACK_URL = `${MOBILE_AUTH_SCHEME}://auth/callback`;
const MOBILE_LOGOUT_CALLBACK_URL = `${MOBILE_AUTH_SCHEME}://auth/logout`;
const MOBILE_AUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access'];
const FEISHU_NATIVE_SCOPES = ['contact:user.base:readonly', 'contact:user.email:readonly'];
const FEISHU_NATIVE_REFRESH_ROUTE = '/api/mobile-auth/feishu/native/refresh';
const FEISHU_NATIVE_EXCHANGE_ROUTE = '/api/mobile-auth/feishu/native/exchange';

let authSessionCache: MobileAuthSession | null | undefined;
const oidcDiscoveryCache = new Map<string, AuthSession.DiscoveryDocument>();

export interface MobileAuthProvider {
  id: string;
  label: string;
  mode: 'qrcode' | 'redirect';
  type: 'builtin' | 'generic';
}

export interface MobileAuthConfig {
  authProviders: MobileAuthProvider[];
  disableEmailPassword: boolean;
  enableNoAuth: boolean;
  enableOIDC: boolean;
  mobileNativeAuth?: {
    feishu?: {
      appId: string;
    };
  };
  oAuthSSOProviders: string[];
}

export interface MobileAuthSession {
  accessToken: string;
  authMode?: 'feishu-native' | 'oidc';
  baseUrl: string;
  expiresIn?: number;
  idToken?: string;
  issuedAt: number;
  refreshToken?: string;
  scope?: string;
  tokenType: string;
}

interface NativeFeishuSignInResult {
  code: string;
  codeVerifier?: string;
}

interface NativeFeishuSSOModule {
  appId?: string;
  startSignIn: (options: {
    appId?: string;
    language?: string;
    scopes?: string[];
  }) => Promise<NativeFeishuSignInResult>;
}

const feishuNativeModule = NativeModules.FeishuSSO as NativeFeishuSSOModule | undefined;

const parseProviderLabel = (providerId: string) =>
  providerId
    .replaceAll(/[_-]+/g, ' ')
    .replaceAll(/\b\w/g, (char) => char.toUpperCase());

const normalizeProviderConfig = (provider: Partial<MobileAuthProvider> & Pick<MobileAuthProvider, 'id'>) => ({
  id: provider.id,
  label: provider.label || parseProviderLabel(provider.id),
  mode: provider.mode || 'redirect',
  type: provider.type || 'generic',
});

const toStoredSession = (
  baseUrl: string,
  tokenResponse: Pick<
    AuthSession.TokenResponse,
    'accessToken' | 'expiresIn' | 'idToken' | 'issuedAt' | 'refreshToken' | 'scope' | 'tokenType'
  >,
  existingSession?: MobileAuthSession | null,
): MobileAuthSession => ({
  accessToken: tokenResponse.accessToken,
  authMode: 'oidc',
  baseUrl: normalizeApiUrl(baseUrl),
  expiresIn: tokenResponse.expiresIn,
  idToken: tokenResponse.idToken,
  issuedAt: tokenResponse.issuedAt,
  refreshToken: tokenResponse.refreshToken ?? existingSession?.refreshToken,
  scope: tokenResponse.scope,
  tokenType: tokenResponse.tokenType || 'bearer',
});

const getIssuerUrl = (baseUrl: string) => {
  return new URL('/oidc', `${normalizeApiUrl(baseUrl)}/`).toString();
};

const getAuthRedirectUri = () =>
  AuthSession.makeRedirectUri({
    native: MOBILE_AUTH_CALLBACK_URL,
    path: 'auth/callback',
    scheme: MOBILE_AUTH_SCHEME,
  });

const getLogoutRedirectUri = () =>
  AuthSession.makeRedirectUri({
    native: MOBILE_LOGOUT_CALLBACK_URL,
    path: 'auth/logout',
    scheme: MOBILE_AUTH_SCHEME,
  });

const getFeishuDirectSignInUrl = (baseUrl: string, callbackUrl: string) => {
  const directSignInUrl = new URL('/api/mobile-auth/feishu/start', `${baseUrl}/`);

  directSignInUrl.searchParams.set('callbackUrl', callbackUrl);

  return directSignInUrl.toString();
};

const getHostedSignInUrl = (baseUrl: string, callbackUrl: string, providerId?: string) => {
  const signInUrl = new URL('/signin', `${baseUrl}/`);

  signInUrl.searchParams.set('callbackUrl', callbackUrl);

  if (providerId) {
    signInUrl.searchParams.set('sso', providerId);
  }

  return signInUrl.toString();
};

const parseTRPCPayload = <T>(payload: any): T => {
  const data = payload?.result?.data;
  return (data && typeof data === 'object' && 'json' in data ? data.json : data) as T;
};

const getFeishuNativeAppId = (config?: MobileAuthConfig | null) => {
  return config?.mobileNativeAuth?.feishu?.appId || feishuNativeModule?.appId;
};

const shouldUseFeishuNativeSignIn = (providerId?: string, config?: MobileAuthConfig | null) => {
  return (
    Platform.OS === 'android' &&
    providerId === 'feishu' &&
    !!feishuNativeModule &&
    !!getFeishuNativeAppId(config)
  );
};

const getPreferredLanguage = () => {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    if (locale.startsWith('zh')) return 'zh';
    if (locale.startsWith('ja')) return 'ja';
    return 'en';
  } catch {
    return 'zh';
  }
};

const requestNativeFeishuSession = async (
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<MobileAuthSession> => {
  const normalizedBaseUrl = normalizeApiUrl(baseUrl);
  const response = await fetch(new URL(path, `${normalizedBaseUrl}/`).toString(), {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  const payload = (await response.json().catch(() => null)) as
    | (Partial<MobileAuthSession> & { error?: string })
    | null;

  if (!response.ok || !payload?.accessToken) {
    throw new Error(payload?.error || `Feishu mobile sign-in failed (${response.status})`);
  }

  return {
    accessToken: payload.accessToken,
    authMode: 'feishu-native',
    baseUrl: normalizedBaseUrl,
    expiresIn: payload.expiresIn,
    idToken: payload.idToken,
    issuedAt: payload.issuedAt || Math.floor(Date.now() / 1000),
    refreshToken: payload.refreshToken,
    scope: payload.scope,
    tokenType: payload.tokenType || 'bearer',
  };
};

export async function loadStoredAuthSession(): Promise<MobileAuthSession | null> {
  if (authSessionCache !== undefined) {
    return authSessionCache;
  }

  const raw = await SecureStore.getItemAsync(AUTH_SESSION_STORAGE_KEY);

  if (!raw) {
    authSessionCache = null;
    return null;
  }

  try {
    authSessionCache = JSON.parse(raw) as MobileAuthSession;
    return authSessionCache;
  } catch {
    authSessionCache = null;
    await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
}

export async function saveStoredAuthSession(session: MobileAuthSession): Promise<void> {
  authSessionCache = session;
  await SecureStore.setItemAsync(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function clearStoredAuthSession(): Promise<void> {
  authSessionCache = null;
  await SecureStore.deleteItemAsync(AUTH_SESSION_STORAGE_KEY);
}

export async function fetchOidcDiscovery(baseUrl: string): Promise<AuthSession.DiscoveryDocument> {
  const normalizedBaseUrl = normalizeApiUrl(baseUrl);

  if (oidcDiscoveryCache.has(normalizedBaseUrl)) {
    return oidcDiscoveryCache.get(normalizedBaseUrl)!;
  }

  let discovery: AuthSession.DiscoveryDocument;

  try {
    discovery = await AuthSession.fetchDiscoveryAsync(getIssuerUrl(normalizedBaseUrl));
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? `Unable to reach the mobile sign-in endpoint: ${error.message}`
        : 'Unable to reach the mobile sign-in endpoint',
      { cause: error },
    );
  }

  oidcDiscoveryCache.set(normalizedBaseUrl, discovery);

  return discovery;
}

export async function fetchMobileAuthConfig(baseUrl: string): Promise<MobileAuthConfig> {
  const normalizedBaseUrl = normalizeApiUrl(baseUrl);
  const response = await fetch(`${normalizedBaseUrl}/trpc/mobile/config.getGlobalConfig`, {
    headers: { 'Content-Type': 'application/json' },
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to load auth config: ${response.status}`);
  }

  const payload = parseTRPCPayload<{ serverConfig?: Partial<MobileAuthConfig> }>(await response.json());
  const serverConfig = payload?.serverConfig || {};
  const authProviders = (serverConfig.authProviders || serverConfig.oAuthSSOProviders || []).map(
    (provider) =>
      typeof provider === 'string'
        ? normalizeProviderConfig({ id: provider })
        : normalizeProviderConfig(provider),
  );

  return {
    authProviders,
    disableEmailPassword: !!serverConfig.disableEmailPassword,
    enableNoAuth: !!serverConfig.enableNoAuth,
    enableOIDC: !!serverConfig.enableOIDC,
    mobileNativeAuth: serverConfig.mobileNativeAuth,
    oAuthSSOProviders: serverConfig.oAuthSSOProviders || authProviders.map((provider) => provider.id),
  };
}

export async function getValidAuthSession(baseUrl: string): Promise<MobileAuthSession | null> {
  const normalizedBaseUrl = normalizeApiUrl(baseUrl);
  const storedSession = await loadStoredAuthSession();

  if (!storedSession || storedSession.baseUrl !== normalizedBaseUrl) {
    return null;
  }

  if (AuthSession.TokenResponse.isTokenFresh(storedSession, -60)) {
    return storedSession;
  }

  if (!storedSession.refreshToken) {
    await clearStoredAuthSession();
    return null;
  }

  try {
    if (storedSession.authMode === 'feishu-native') {
      const nextSession = await requestNativeFeishuSession(
        normalizedBaseUrl,
        FEISHU_NATIVE_REFRESH_ROUTE,
        {
          refreshToken: storedSession.refreshToken,
        },
      );
      await saveStoredAuthSession(nextSession);

      return nextSession;
    }

    const discovery = await fetchOidcDiscovery(normalizedBaseUrl);
    const refreshedToken = await AuthSession.refreshAsync(
      {
        clientId: MOBILE_CLIENT_ID,
        refreshToken: storedSession.refreshToken,
      },
      discovery,
    );
    const nextSession = toStoredSession(normalizedBaseUrl, refreshedToken, storedSession);
    await saveStoredAuthSession(nextSession);

    return nextSession;
  } catch {
    await clearStoredAuthSession();
    return null;
  }
}

export async function getAuthHeaders(baseUrl: string): Promise<Record<string, string>> {
  const session = await getValidAuthSession(baseUrl);

  if (!session) {
    return {};
  }

  const tokenType = session.tokenType || 'bearer';
  const authorizationValue = `${tokenType[0]?.toUpperCase() || 'B'}${tokenType.slice(1)} ${session.accessToken}`;

  return {
    Authorization: authorizationValue,
    'Oidc-Auth': session.accessToken,
  };
}

export async function signInWithProvider(options: {
  authConfig?: MobileAuthConfig | null;
  baseUrl: string;
  providerId?: string;
}): Promise<MobileAuthSession | null> {
  const normalizedBaseUrl = normalizeApiUrl(options.baseUrl);

  if (shouldUseFeishuNativeSignIn(options.providerId, options.authConfig)) {
    const appId = getFeishuNativeAppId(options.authConfig);

    if (!appId) {
      throw new Error('Feishu mobile sign-in is not configured on this server.');
    }

    let nativeResult: NativeFeishuSignInResult;

    try {
      nativeResult = await feishuNativeModule!.startSignIn({
        appId,
        language: getPreferredLanguage(),
        scopes: FEISHU_NATIVE_SCOPES,
      });
    } catch (error) {
      throw new Error(
        error instanceof Error && error.message
          ? error.message
          : 'Unable to launch the Feishu app for sign-in.',
        { cause: error },
      );
    }

    if (!nativeResult?.code) {
      throw new Error('Feishu sign-in did not return an authorization code.');
    }

    const session = await requestNativeFeishuSession(normalizedBaseUrl, FEISHU_NATIVE_EXCHANGE_ROUTE, {
      code: nativeResult.code,
      codeVerifier: nativeResult.codeVerifier,
    });

    await saveStoredAuthSession(session);

    return session;
  }

  const discovery = await fetchOidcDiscovery(normalizedBaseUrl);
  const redirectUri = getAuthRedirectUri();
  const request = new AuthSession.AuthRequest({
    clientId: MOBILE_CLIENT_ID,
    extraParams: {
      resource: 'urn:lobehub:chat',
    },
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: MOBILE_AUTH_SCOPES,
    usePKCE: true,
  });
  const authorizeUrl = await request.makeAuthUrlAsync(discovery);
  const signInUrl =
    options.providerId === 'feishu'
      ? getFeishuDirectSignInUrl(normalizedBaseUrl, authorizeUrl)
      : getHostedSignInUrl(normalizedBaseUrl, authorizeUrl, options.providerId);

  let result: AuthSession.AuthSessionResult;

  try {
    result = await request.promptAsync(discovery, { url: signInUrl });
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? `Unable to open the browser sign-in flow: ${error.message}`
        : 'Unable to open the browser sign-in flow',
      { cause: error },
    );
  }

  if (result.type === 'cancel' || result.type === 'dismiss' || result.type === 'locked') {
    return null;
  }

  if (result.type !== 'success' || !result.params.code || !request.codeVerifier) {
    throw new Error('Authentication was not completed');
  }

  let tokenResponse: AuthSession.TokenResponse;

  try {
    tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId: MOBILE_CLIENT_ID,
        code: result.params.code,
        extraParams: {
          code_verifier: request.codeVerifier,
        },
        redirectUri,
      },
      discovery,
    );
  } catch (error) {
    throw new Error(
      error instanceof Error && error.message
        ? `The sign-in page returned, but token exchange failed: ${error.message}`
        : 'The sign-in page returned, but token exchange failed',
      { cause: error },
    );
  }

  const session = toStoredSession(normalizedBaseUrl, tokenResponse);
  await saveStoredAuthSession(session);

  return session;
}

export async function signOutFromBrowser(baseUrl: string): Promise<void> {
  const normalizedBaseUrl = normalizeApiUrl(baseUrl);
  const storedSession = await loadStoredAuthSession();

  if (storedSession?.authMode === 'feishu-native') {
    await clearStoredAuthSession();
    return;
  }

  const redirectUri = getLogoutRedirectUri();
  const signOutUrl = new URL('/mobile-auth/signout', `${normalizedBaseUrl}/`);

  signOutUrl.searchParams.set('callbackUrl', redirectUri);

  try {
    await WebBrowser.openAuthSessionAsync(signOutUrl.toString(), redirectUri);
  } catch {
    // Best-effort remote sign-out.
  } finally {
    await clearStoredAuthSession();
  }
}
