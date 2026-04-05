import { afterEach, describe, expect, it } from 'vitest';

import {
  getActiveWorkspaceSpaceId,
  getCurrentWorkspaceSpaceId,
  getWorkspaceSpaceIdFromPathname,
  resolveWorkspaceSpaceId,
  setActiveWorkspaceSpaceId,
} from './activeWorkspaceSpace';

describe('activeWorkspaceSpace', () => {
  afterEach(() => {
    setActiveWorkspaceSpaceId(undefined);
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
  });

  it('extracts the current space id from canonical space routes', () => {
    expect(getWorkspaceSpaceIdFromPathname('/spaces/spc_ops/files')).toBe('spc_ops');
    expect(getWorkspaceSpaceIdFromPathname('/spaces/spc_ops/docs/table/2')).toBe('spc_ops');
  });

  it('ignores non-space shared and trash routes', () => {
    expect(getWorkspaceSpaceIdFromPathname('/spaces/shared')).toBeUndefined();
    expect(getWorkspaceSpaceIdFromPathname('/spaces/trash')).toBeUndefined();
  });

  it('prefers the route-derived space id over the mutable hint', () => {
    setActiveWorkspaceSpaceId('spc_hint');
    window.history.replaceState({}, '', '/spaces/spc_route/files');

    expect(getActiveWorkspaceSpaceId()).toBe('spc_route');
  });

  it('gets the current route-derived space id without falling back to the hint', () => {
    setActiveWorkspaceSpaceId('spc_hint');
    window.history.replaceState({}, '', '/library');

    expect(getCurrentWorkspaceSpaceId()).toBeUndefined();
  });

  it('resolves space id with explicit, route, fallback, then hint priority', () => {
    setActiveWorkspaceSpaceId('spc_hint');
    window.history.replaceState({}, '', '/spaces/spc_route/files');

    expect(resolveWorkspaceSpaceId({ fallbackSpaceId: 'spc_fallback' })).toBe('spc_route');
    expect(resolveWorkspaceSpaceId({ spaceId: 'spc_explicit' })).toBe('spc_explicit');

    window.history.replaceState({}, '', '/library');

    expect(resolveWorkspaceSpaceId({ fallbackSpaceId: 'spc_fallback' })).toBe('spc_fallback');
    expect(resolveWorkspaceSpaceId()).toBe('spc_hint');
  });
});
