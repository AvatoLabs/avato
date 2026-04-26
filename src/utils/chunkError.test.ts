/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupChunkReloadMarker,
  isChunkLoadError,
  tryHardReloadForChunkError,
} from './chunkError';

describe('chunkError', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/spa/docs');
    window.sessionStorage.clear();
  });

  it('detects missing lazy-module errors as chunk load errors', () => {
    expect(
      isChunkLoadError(
        new TypeError("Cannot use 'in' operator to search for 'default' in undefined"),
      ),
    ).toBe(true);
    expect(isChunkLoadError(new Error('Dynamic import returned no module'))).toBe(true);
  });

  it('forces a single hard reload with a cache-busting marker', () => {
    const replaceSpy = vi.spyOn(window.location, 'replace').mockImplementation(() => undefined);

    const didReload = tryHardReloadForChunkError();

    expect(didReload).toBe(true);
    expect(window.sessionStorage.getItem('lobe:chunk:hard-reload-attempts')).toBe('1');
    expect(replaceSpy).toHaveBeenCalledTimes(1);
    expect(replaceSpy.mock.calls[0][0]).toContain('__lobe_force_reload=');
  });

  it('removes the force-reload marker without resetting the retry budget', () => {
    window.history.replaceState(null, '', '/spa/docs?__lobe_force_reload=123');
    window.sessionStorage.setItem('lobe:chunk:hard-reload-attempts', '1');

    cleanupChunkReloadMarker();

    expect(window.location.search).toBe('');
    expect(window.sessionStorage.getItem('lobe:chunk:hard-reload-attempts')).toBe('1');
  });
});
