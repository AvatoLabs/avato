import { describe, expect, it, vi } from 'vitest';

import { createTopicShareAttachmentUrlResolver } from './createTopicShareAttachmentUrlResolver';

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
    INTERNAL_APP_URL: 'http://internal.example.com',
  },
}));

describe('createTopicShareAttachmentUrlResolver', () => {
  it('should proxy internal attachment urls through the topic share file route', async () => {
    const resolver = createTopicShareAttachmentUrlResolver('share-1');

    await expect(
      resolver('internal://blob-key', { fileType: 'image/png', id: 'file-1' }),
    ).resolves.toBe('/share/t/share-1/f/file-1');
  });

  it('should preserve absolute urls', async () => {
    const resolver = createTopicShareAttachmentUrlResolver('share-2');

    await expect(
      resolver('https://cdn.example.com/file.png', { fileType: 'image/png', id: 'file-2' }),
    ).resolves.toBe('https://cdn.example.com/file.png');
  });

  it('should normalize same-origin absolute urls back to the topic share proxy route', async () => {
    const resolver = createTopicShareAttachmentUrlResolver('share-3');

    await expect(
      resolver('https://app.example.com/f/legacy-file', { fileType: 'image/png', id: 'file-3' }),
    ).resolves.toBe('/share/t/share-3/f/file-3');
  });
});
