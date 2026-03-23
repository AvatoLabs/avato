/**
 * Build fetch options for loading user media (e.g. `/f/:id`) vs third-party URLs (e.g. S3 presigned).
 * Same-origin requests must send cookies for authenticated file proxy; cross-origin presigned URLs must not.
 */
export const getMediaFetchInit = (url: string): Pick<RequestInit, 'credentials' | 'mode'> => {
  let sameOrigin = false;
  try {
    sameOrigin = new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    /* invalid url */
  }

  return {
    credentials: sameOrigin ? 'include' : 'omit',
    mode: 'cors',
  };
};
