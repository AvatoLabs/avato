/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageService } from '../../../packages/openapi/src/services/message.service';

vi.mock('@/envs/app', () => ({
  appEnv: {
    APP_URL: 'https://app.example.com',
    INTERNAL_APP_URL: 'http://internal.example.com',
  },
}));

vi.mock('@/server/services/file', () => ({
  FileService: vi.fn(() => ({
    getFullFileUrl: vi.fn().mockResolvedValue('https://example.com/file-1'),
  })),
}));

describe('OpenAPI MessageService attachments', () => {
  let service: MessageService;

  beforeEach(() => {
    vi.clearAllMocks();

    service = new MessageService({} as any, 'user-1');

    (service as any).contentAuthorizer.assertCapability = vi
      .fn()
      .mockResolvedValue({ contentUid: 'res_file_1', matchedBy: 'space_member', spaceId: 'spc_1' });
    (service as any).contentModel.createAccessEvent = vi.fn().mockResolvedValue(undefined);
    (service as any).coreFileService.getFullFileUrl = vi
      .fn()
      .mockResolvedValue('https://example.com/file-1');
  });

  it('signs internal attachment urls through file capability and records file_url_issued events', async () => {
    const result = await (service as any).formatMessages([
      {
        content: 'hello',
        filesToMessages: [
          {
            file: {
              id: 'file_1',
              name: 'notes.txt',
              url: 'internal://notes',
            },
            messageId: 'msg_1',
          },
        ],
        id: 'msg_1',
        session: null,
        topic: null,
      },
    ]);

    expect((service as any).contentAuthorizer.assertCapability).toHaveBeenCalledWith({
      capability: 'download_blob',
      id: 'file_1',
      kind: 'file',
    });
    expect((service as any).coreFileService.getFullFileUrl).toHaveBeenCalledWith(
      'internal://notes',
      undefined,
    );
    expect((service as any).contentModel.createAccessEvent).toHaveBeenCalledWith({
      accessType: 'file_url_issued',
      contentUid: 'res_file_1',
      metadata: {
        fileId: 'file_1',
        matchedBy: 'space_member',
        via: 'openapi_message_attachment',
      },
      shareLinkId: null,
      sourceIp: null,
      spaceId: 'spc_1',
      userAgent: null,
    });
    expect(result[0].files).toEqual([
      expect.objectContaining({
        id: 'file_1',
        url: 'https://example.com/file-1',
      }),
    ]);
  });

  it('keeps absolute attachment urls but still enforces file capability and audit logging', async () => {
    const result = await (service as any).formatMessages([
      {
        content: 'hello',
        filesToMessages: [
          {
            file: {
              id: 'file_abs',
              name: 'notes.txt',
              url: 'https://cdn.example.com/notes.txt',
            },
            messageId: 'msg_abs',
          },
        ],
        id: 'msg_abs',
        session: null,
        topic: null,
      },
    ]);

    expect((service as any).contentAuthorizer.assertCapability).toHaveBeenCalledWith({
      capability: 'download_blob',
      id: 'file_abs',
      kind: 'file',
    });
    expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
    expect((service as any).contentModel.createAccessEvent).toHaveBeenCalledWith({
      accessType: 'file_url_issued',
      contentUid: 'res_file_1',
      metadata: {
        fileId: 'file_abs',
        matchedBy: 'space_member',
        via: 'openapi_message_attachment',
      },
      shareLinkId: null,
      sourceIp: null,
      spaceId: 'spc_1',
      userAgent: null,
    });
    expect(result[0].files).toEqual([
      expect.objectContaining({
        id: 'file_abs',
        url: 'https://cdn.example.com/notes.txt',
      }),
    ]);
  });

  it('preserves same-origin stable proxy attachment urls instead of re-signing them', async () => {
    const result = await (service as any).formatMessages([
      {
        content: 'hello',
        filesToMessages: [
          {
            file: {
              id: 'file_same_origin',
              name: 'notes.txt',
              url: 'https://app.example.com/f/file_same_origin',
            },
            messageId: 'msg_same_origin',
          },
        ],
        id: 'msg_same_origin',
        session: null,
        topic: null,
      },
    ]);

    expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
    expect(result[0].files).toEqual([
      expect.objectContaining({
        id: 'file_same_origin',
        url: 'https://app.example.com/f/file_same_origin',
      }),
    ]);
  });

  it('upgrades relative stable proxy attachment urls to absolute app urls without re-signing them', async () => {
    const result = await (service as any).formatMessages([
      {
        content: 'hello',
        filesToMessages: [
          {
            file: {
              id: 'file_relative_proxy',
              name: 'notes.txt',
              url: '/share/t/share_1/f/file_relative_proxy',
            },
            messageId: 'msg_relative_proxy',
          },
        ],
        id: 'msg_relative_proxy',
        session: null,
        topic: null,
      },
    ]);

    expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
    expect(result[0].files).toEqual([
      expect.objectContaining({
        id: 'file_relative_proxy',
        url: 'https://app.example.com/share/t/share_1/f/file_relative_proxy',
      }),
    ]);
  });

  it('skips inaccessible internal attachments without failing the message response', async () => {
    vi.mocked((service as any).contentAuthorizer.assertCapability).mockRejectedValueOnce(
      new Error('forbidden'),
    );

    const result = await (service as any).formatMessages([
      {
        content: 'hello',
        filesToMessages: [
          {
            file: {
              id: 'file_2',
              name: 'secret.txt',
              url: 'internal://secret',
            },
            messageId: 'msg_2',
          },
        ],
        id: 'msg_2',
        session: null,
        topic: null,
      },
    ]);

    expect((service as any).coreFileService.getFullFileUrl).not.toHaveBeenCalled();
    expect((service as any).contentModel.createAccessEvent).not.toHaveBeenCalled();
    expect(result[0].files).toEqual([]);
  });

  it('does not fail message formatting when access-event logging fails', async () => {
    vi.mocked((service as any).contentModel.createAccessEvent).mockRejectedValueOnce(
      new Error('redis offline'),
    );

    await expect(
      (service as any).formatMessages([
        {
          content: 'hello',
          filesToMessages: [
            {
              file: {
                id: 'file_3',
                name: 'notes.txt',
                url: 'internal://notes-3',
              },
              messageId: 'msg_3',
            },
          ],
          id: 'msg_3',
          session: null,
          topic: null,
        },
      ]),
    ).resolves.toEqual([
      expect.objectContaining({
        files: [expect.objectContaining({ id: 'file_3', url: 'https://example.com/file-1' })],
      }),
    ]);
  });
});
