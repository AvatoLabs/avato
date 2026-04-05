import { describe, expect, it, vi } from 'vitest';

import { createAuthenticatedAttachmentUrlResolver } from './createAuthenticatedAttachmentUrlResolver';

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
    INTERNAL_APP_URL: 'http://internal.example.com',
  },
}));

describe('createAuthenticatedAttachmentUrlResolver', () => {
  it('should proxy internal attachment urls through the file route', async () => {
    const resolver = createAuthenticatedAttachmentUrlResolver();

    await expect(
      resolver('internal://blob-key', { fileType: 'image/png', id: 'file-1' }),
    ).resolves.toBe('/f/file-1');
  });

  it('should preserve absolute urls', async () => {
    const resolver = createAuthenticatedAttachmentUrlResolver();

    await expect(
      resolver('https://cdn.example.com/file.png', { fileType: 'image/png', id: 'file-2' }),
    ).resolves.toBe('https://cdn.example.com/file.png');
  });

  it('should normalize same-origin absolute urls back to the file proxy route', async () => {
    const resolver = createAuthenticatedAttachmentUrlResolver();

    await expect(
      resolver('https://app.example.com/f/legacy-file', { fileType: 'image/png', id: 'file-4' }),
    ).resolves.toBe('/f/file-4');
  });

  it('should return empty string for empty paths', async () => {
    const resolver = createAuthenticatedAttachmentUrlResolver();

    await expect(resolver(null, { fileType: 'image/png', id: 'file-3' })).resolves.toBe('');
  });
});
