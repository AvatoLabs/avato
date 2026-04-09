import { describe, expect, it, vi } from 'vitest';

vi.mock('@/config/routes', () => ({
  getRouteById: vi.fn(() => ({ icon: 'resource-icon' })),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesRootPath: (spaceId?: string | null) => (spaceId ? `/spaces/${spaceId}/files` : '/spaces'),
  buildFilesTrashPath: (spaceId?: string | null) =>
    spaceId ? `/spaces/${spaceId}/files/trash` : '/spaces/trash',
  buildSharedFilesPath: () => '/spaces/shared',
  buildSpaceMembersPath: (spaceId: string) => `/spaces/${spaceId}/members`,
  buildSpaceSettingsPath: (spaceId: string) => `/spaces/${spaceId}/settings`,
}));

import { resourcePlugin } from './contentPlugin';

describe('resourcePlugin', () => {
  it('uses canonical shared and trash urls for global resource entries', () => {
    expect(
      resourcePlugin.generateUrl({
        params: { section: 'shared' },
      } as any),
    ).toBe('/spaces/shared');
    expect(
      resourcePlugin.generateUrl({
        params: { section: 'trash' },
      } as any),
    ).toBe('/spaces/trash');
    expect(
      resourcePlugin.generateUrl({
        params: {},
      } as any),
    ).toBe('/spaces');
  });

  it('matches canonical shared and trash routes', () => {
    expect(resourcePlugin.matchUrl('/spaces/shared', new URLSearchParams())).toBe(true);
    expect(resourcePlugin.matchUrl('/spaces/trash', new URLSearchParams())).toBe(true);
  });

  it('parses canonical shared and trash routes into global resource references', () => {
    expect(resourcePlugin.parseUrl('/spaces/shared', new URLSearchParams())).toMatchObject({
      params: { section: 'shared' },
      type: 'resource',
    });
    expect(resourcePlugin.parseUrl('/spaces/trash', new URLSearchParams())).toMatchObject({
      params: { section: 'trash' },
      type: 'resource',
    });
  });

  it('parses canonical space-scoped resource routes', () => {
    expect(resourcePlugin.parseUrl('/spaces/spc_1/files', new URLSearchParams())).toMatchObject({
      params: { section: 'files', spaceId: 'spc_1' },
      type: 'resource',
    });
    expect(
      resourcePlugin.parseUrl('/spaces/spc_1/settings', new URLSearchParams()),
    ).toMatchObject({
      params: { section: 'settings', spaceId: 'spc_1' },
      type: 'resource',
    });
  });
});
