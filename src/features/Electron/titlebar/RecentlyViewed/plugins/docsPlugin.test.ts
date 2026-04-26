import { describe, expect, it, vi } from 'vitest';

import { pagePlugin } from './docsPlugin';

vi.mock('@/config/routes', () => ({
  getRouteById: vi.fn(() => ({ icon: 'page-icon' })),
}));

const createContext = (document?: Record<string, unknown>) =>
  ({
    getDocument: vi.fn(() => document),
    t: (key: string) => `t:${key}`,
  }) as any;

describe('pagePlugin', () => {
  it('matches document and table page detail routes', () => {
    expect(pagePlugin.matchUrl('/spaces/spc_1/docs/doc_1', new URLSearchParams())).toBe(true);
    expect(pagePlugin.matchUrl('/spaces/spc_1/docs/table/table_1', new URLSearchParams())).toBe(
      true,
    );
    expect(pagePlugin.matchUrl('/spaces/spc_1/docs', new URLSearchParams())).toBe(false);
  });

  it('parses document routes into page references', () => {
    expect(pagePlugin.parseUrl('/spaces/spc_1/docs/doc_1', new URLSearchParams())).toMatchObject({
      id: 'page:doc_1',
      params: {
        pageId: 'doc_1',
        pageKind: undefined,
        spaceId: 'spc_1',
      },
      type: 'page',
    });
  });

  it('parses table routes into table page references', () => {
    expect(
      pagePlugin.parseUrl('/spaces/spc_1/docs/table/table_1', new URLSearchParams()),
    ).toMatchObject({
      id: 'page:table_1',
      params: {
        pageId: 'table_1',
        pageKind: 'table',
        spaceId: 'spc_1',
      },
      type: 'page',
    });
  });

  it('generates canonical document and table urls', () => {
    expect(
      pagePlugin.generateUrl({
        params: { pageId: 'doc-alpha', spaceId: 'spc_1' },
      } as any),
    ).toBe('/spaces/spc_1/docs/doc-alpha');
    expect(
      pagePlugin.generateUrl({
        params: { pageId: 'table-alpha', pageKind: 'table', spaceId: 'spc_1' },
      } as any),
    ).toBe('/spaces/spc_1/docs/table/table-alpha');
  });

  it('checks existence through the document store context', () => {
    expect(
      pagePlugin.checkExists(
        { params: { pageId: 'doc_1' } } as any,
        createContext({ id: 'doc_1' }),
      ),
    ).toBe(true);
    expect(pagePlugin.checkExists({ params: { pageId: 'missing' } } as any, createContext())).toBe(
      false,
    );
  });

  it('resolves title and url from store data when available', () => {
    const resolved = pagePlugin.resolve(
      {
        params: { pageId: 'table-alpha', spaceId: 'spc_1' },
      } as any,
      createContext({
        id: 'table-alpha',
        metadata: { pageKind: 'table' },
        title: 'Quarterly Plan',
      }),
    );

    expect(resolved).toMatchObject({
      exists: true,
      title: 'Quarterly Plan',
      url: '/spaces/spc_1/docs/table/table-alpha',
    });
  });

  it('falls back to cached data for stale document references', () => {
    const resolved = pagePlugin.resolve(
      {
        cached: { title: 'Cached Plan' },
        params: { pageId: 'doc-alpha', pageKind: 'doc', spaceId: 'spc_1' },
      } as any,
      createContext(),
    );

    expect(resolved).toMatchObject({
      exists: true,
      title: 'Cached Plan',
      url: '/spaces/spc_1/docs/doc-alpha',
    });
  });
});
