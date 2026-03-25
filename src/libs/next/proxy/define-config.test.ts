import { type NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { defineConfig } from './define-config';

const { getSessionMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
}));

vi.mock('@/auth', () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

vi.mock('@/const/locale', () => ({
  LOBE_LOCALE_COOKIE: 'lobe-locale',
}));

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://canary.turingmesh.com',
    MIDDLEWARE_REWRITE_THROUGH_LOCAL: false,
  },
}));

vi.mock('@/envs/auth', () => ({
  authEnv: {
    ENABLE_OIDC: false,
  },
}));

vi.mock('../../../utils/locale', () => ({
  parseBrowserLanguage: vi.fn(() => 'en-US'),
}));

vi.mock('../../../utils/server/routeVariants', () => ({
  RouteVariants: {
    serializeVariants: vi.fn(() => 'en-US__0'),
  },
}));

const createMockRequest = ({
  headers,
  method = 'GET',
  pathname = '/agent',
  search = '',
}: {
  headers?: Record<string, string>;
  method?: string;
  pathname?: string;
  search?: string;
}): NextRequest => {
  const nextUrl = new URL(`https://canary.turingmesh.com${pathname}${search}`);

  return {
    cookies: {
      get: vi.fn(),
    },
    headers: new Headers({
      'user-agent': 'Mozilla/5.0',
      ...headers,
    }),
    method,
    nextUrl,
    url: nextUrl.toString(),
  } as unknown as NextRequest;
};

describe('defineConfig middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects unauthenticated protected page requests to signin', async () => {
    getSessionMock.mockResolvedValue(null);

    const { middleware } = defineConfig();
    const response = await middleware(createMockRequest({ pathname: '/agent' }));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      'https://canary.turingmesh.com/signin?callbackUrl=https%3A%2F%2Fcanary.turingmesh.com%2Fagent',
    );
  });

  it('does not redirect unauthenticated server action requests in middleware', async () => {
    getSessionMock.mockResolvedValue(null);

    const { middleware } = defineConfig();
    const response = await middleware(
      createMockRequest({
        headers: {
          'next-action': 'test-action',
        },
        method: 'POST',
        pathname: '/agent',
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('x-middleware-rewrite')).toContain('/spa/en-US__0/agent');
  });
});
