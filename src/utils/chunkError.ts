import { toast } from '@lobehub/ui';

const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module', // Chrome / Vite
  'error loading dynamically imported module', // Firefox
  'Importing a module script failed', // Safari
  'Failed to load module script', // Safari variant
  'Loading chunk', // Webpack
  'Loading CSS chunk', // Webpack CSS
  'ChunkLoadError', // Webpack error name
  "Cannot use 'in' operator to search for 'default' in undefined", // stale lazy module resolution
  'Dynamic import returned no module', // guarded lazy import error
  'Dynamic import returned an empty default export', // guarded lazy import error
];

const CHUNK_RELOAD_SESSION_KEY = 'lobe:chunk:hard-reload-attempts';
const CHUNK_RELOAD_QUERY_KEY = '__lobe_force_reload';
const DEFAULT_MAX_RELOADS = 1;

/**
 * Detect whether an error (or its message) was caused by a failed chunk / dynamic import.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  const name = (error as Error).name ?? '';
  const message = (error as Error).message ?? String(error);
  const combined = `${name} ${message}`;

  return CHUNK_ERROR_PATTERNS.some((p) => combined.includes(p));
}

/**
 * Show user notification for chunk load error (no reload).
 */
export function notifyChunkError(): void {
  toast.info('Web app has been updated so it needs to be reloaded.');
}

export function tryHardReloadForChunkError(maxReloads = DEFAULT_MAX_RELOADS): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const attempts = Number(window.sessionStorage.getItem(CHUNK_RELOAD_SESSION_KEY) ?? '0');

    if (attempts >= maxReloads) {
      return false;
    }

    window.sessionStorage.setItem(CHUNK_RELOAD_SESSION_KEY, String(attempts + 1));
  } catch {
    // If sessionStorage is unavailable, still attempt a single hard reload.
  }

  const url = new URL(window.location.href);
  url.searchParams.set(CHUNK_RELOAD_QUERY_KEY, Date.now().toString());
  window.location.replace(url.toString());

  return true;
}

export function cleanupChunkReloadMarker(): void {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  if (!url.searchParams.has(CHUNK_RELOAD_QUERY_KEY)) return;

  url.searchParams.delete(CHUNK_RELOAD_QUERY_KEY);
  window.history.replaceState(window.history.state, '', url.toString());
}
