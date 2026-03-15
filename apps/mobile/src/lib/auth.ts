import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

import { normalizeApiUrl } from './server';

WebBrowser.maybeCompleteAuthSession();

const AUTH_SESSION_STORAGE_KEY = 'avato_oidc_session';
const MOBILE_CLIENT_ID = 'lobehub-mobile';
const MOBILE_AUTH_SCHEME = 'com.avato.app';
const MOBILE_AUTH_CALLBACK_URL = `${MOBILE_AUTH_SCHEME}://auth/callback`;
const MOBILE_LOGOUT_CALLBACK_URL = `${MOBILE_AUTH_SCHEME}://auth/logout`;
const MOBILE_AUTH_SCOPES = ['openid', 'profile', 'email', 'offline_access'];

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
  oAuthSSOProviders: string[];
}

export interface MobileAuthSession {
  accessToken: string;
  baseUrl: string;
  expiresIn?: number;
  idToken?: string;
  issuedAt: number;
  refreshToken?: string;
  scope?: string;
  tokenType: string;
}

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

const parseTRPCPayload = <T>(payload: any): T => {
  const data = payload?.result?.data;
  return (data && typeof data === 'object' && 'json' in data ? data.json : data) as T;
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

  const discovery = await AuthSession.fetchDiscoveryAsync(getIssuerUrl(normalizedBaseUrl));
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

export async function signInWithBrowser(options: {
  baseUrl: string;
  providerId?: string;
}): Promise<MobileAuthSession | null> {
  const normalizedBaseUrl = normalizeApiUrl(options.baseUrl);
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
  const signInUrl = new URL('/signin', `${normalizedBaseUrl}/`);

  signInUrl.searchParams.set('callbackUrl', authorizeUrl);

  if (options.providerId) {
    signInUrl.searchParams.set('sso', options.providerId);
  }

  const result = await request.promptAsync(discovery, { url: signInUrl.toString() });

  if (result.type === 'cancel' || result.type === 'dismiss' || result.type === 'locked') {
    return null;
  }

  if (result.type !== 'success' || !result.params.code || !request.codeVerifier) {
    throw new Error('Authentication was not completed');
  }

  const tokenResponse = await AuthSession.exchangeCodeAsync(
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
  const session = toStoredSession(normalizedBaseUrl, tokenResponse);
  await saveStoredAuthSession(session);

  return session;
}

export async function signOutFromBrowser(baseUrl: string): Promise<void> {
  const normalizedBaseUrl = normalizeApiUrl(baseUrl);
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
