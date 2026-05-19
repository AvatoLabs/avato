import { describe, expect, it } from 'vitest';

import {
  createPendingAttachmentId,
  createPickedAttachment,
  createWorkspacePendingAttachment,
} from './chatAttachments';

describe('createPendingAttachmentId', () => {
  it('builds stable ids from injected clock and random parts', () => {
    expect(createPendingAttachmentId({ now: 123, random: 'abc123' })).toBe('123-abc123');
  });
});

describe('createPickedAttachment', () => {
  it('fills missing name/type/size with fallbacks', () => {
    expect(
      createPickedAttachment({
        fallbackName: 'image.jpg',
        fallbackType: 'image/jpeg',
        id: '1-abc',
        uri: 'file:///tmp/image.jpg',
      }),
    ).toEqual({
      id: '1-abc',
      name: 'image.jpg',
      size: 0,
      type: 'image/jpeg',
      uri: 'file:///tmp/image.jpg',
    });
  });
});

describe('createWorkspacePendingAttachment', () => {
  it('keeps absolute remote urls when present', () => {
    expect(
      createWorkspacePendingAttachment(
        {
          fileType: 'image/png',
          id: 'file-1',
          name: 'asset.png',
          size: 42,
          url: 'https://example.com/file-1',
        },
        'https://api.example.com/',
        'workspace-1',
      ),
    ).toMatchObject({
      fileId: 'file-1',
      uri: 'https://example.com/file-1',
      url: 'https://example.com/file-1',
    });
  });

  it('builds a file endpoint from the api base when only relative resource metadata exists', () => {
    expect(
      createWorkspacePendingAttachment(
        {
          fileType: 'application/pdf',
          id: 'file-2',
          name: 'doc.pdf',
          size: 24,
          url: '',
        },
        'https://api.example.com/',
        'workspace-2',
      ),
    ).toMatchObject({
      uri: 'https://api.example.com/f/file-2',
      url: 'https://api.example.com/f/file-2',
    });
  });
});
