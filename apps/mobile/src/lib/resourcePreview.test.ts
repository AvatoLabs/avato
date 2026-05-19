import { describe, expect, it } from 'vitest';

import {
  buildRemoteFetchInit,
  buildRemoteFileCandidates,
  buildRemoteSource,
  resolveRemoteFileUrl,
} from './resourcePreviewUrl';

describe('resolveRemoteFileUrl', () => {
  it('prefers explicit remote urls', () => {
    expect(
      resolveRemoteFileUrl('https://api.example.com', {
        id: 'file-1',
        url: 'https://cdn.example.com/file-1',
      }),
    ).toBe('https://cdn.example.com/file-1');
  });

  it('resolves relative urls against api base', () => {
    expect(
      resolveRemoteFileUrl('https://api.example.com', {
        id: 'file-1',
        url: '/f/file-1',
      }),
    ).toBe('https://api.example.com/f/file-1');
  });
});

describe('buildRemoteSource', () => {
  it('attaches auth headers only for same-origin urls', () => {
    expect(
      buildRemoteSource('https://api.example.com', 'https://api.example.com/f/file-1', {
        Authorization: 'Bearer token',
      }),
    ).toEqual({
      headers: { Authorization: 'Bearer token' },
      uri: 'https://api.example.com/f/file-1',
    });

    expect(
      buildRemoteSource('https://api.example.com', 'https://cdn.example.com/file-1', {
        Authorization: 'Bearer token',
      }),
    ).toEqual({
      uri: 'https://cdn.example.com/file-1',
    });
  });
});

describe('buildRemoteFetchInit', () => {
  it('returns headers only when needed', () => {
    expect(
      buildRemoteFetchInit('https://api.example.com', 'https://api.example.com/f/file-1', {
        Authorization: 'Bearer token',
      }),
    ).toEqual({ headers: { Authorization: 'Bearer token' } });

    expect(
      buildRemoteFetchInit('https://api.example.com', 'https://cdn.example.com/file-1', {
        Authorization: 'Bearer token',
      }),
    ).toBeUndefined();
  });
});

describe('buildRemoteFileCandidates', () => {
  it('returns canonical and proxy candidates without duplicates', () => {
    expect(
      buildRemoteFileCandidates('https://api.example.com', {
        id: 'file-1',
        url: '/f/file-1',
      }),
    ).toEqual(['https://api.example.com/f/file-1']);

    expect(
      buildRemoteFileCandidates('https://api.example.com', {
        id: 'file-2',
        url: 'https://cdn.example.com/file-2',
      }),
    ).toEqual(['https://cdn.example.com/file-2', 'https://api.example.com/f/file-2']);
  });
});
