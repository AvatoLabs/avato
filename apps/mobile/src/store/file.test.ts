import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useFileStore } from './file';

const { toastShowMock, uploadMock } = vi.hoisted(() => ({
  toastShowMock: vi.fn(),
  uploadMock: vi.fn(),
}));

vi.mock('../components/ui/Toast', () => ({
  useToast: {
    getState: () => ({
      show: toastShowMock,
    }),
  },
}));

vi.mock('../lib/api', () => ({
  fileApi: {
    upload: uploadMock,
  },
}));

vi.mock('../lib/i18n', () => ({
  useI18n: {
    getState: () => ({
      t: {
        fileUploadError: 'Upload failed',
        fileUploadFailed: 'Upload rejected',
      },
    }),
  },
}));

vi.mock('../lib/resourceList', () => ({
  isCanonicalDocumentItem: () => false,
}));

const baseState = {
  chatContextSelections: [],
  pendingFiles: [],
  sessionChatContextSelections: {},
  sessionPendingFiles: {},
};

describe('useFileStore pending files', () => {
  beforeEach(() => {
    uploadMock.mockReset();
    toastShowMock.mockReset();
    useFileStore.setState(baseState);
  });

  it('keeps session pending files isolated from the global composer bucket', () => {
    const store = useFileStore.getState();

    store.addFile({
      id: 'global-file',
      name: 'global.txt',
      size: 1,
      type: 'text/plain',
      uri: 'file:///global.txt',
    });
    store.addFile(
      {
        id: 'session-file',
        name: 'session.txt',
        size: 1,
        type: 'text/plain',
        uri: 'file:///session.txt',
      },
      { sessionId: 'session-1' },
    );

    expect(useFileStore.getState().pendingFiles.map((file) => file.id)).toEqual(['global-file']);
    expect(
      useFileStore.getState().sessionPendingFiles['session-1']?.map((file) => file.id),
    ).toEqual(['session-file']);

    useFileStore.getState().clearPending({ sessionId: 'session-1' });

    expect(useFileStore.getState().pendingFiles.map((file) => file.id)).toEqual(['global-file']);
    expect(useFileStore.getState().sessionPendingFiles['session-1']).toBeUndefined();
  });

  it('uploads the targeted session bucket without mutating global pending files', async () => {
    uploadMock.mockResolvedValue({ id: 'uploaded-1', url: 'https://example.com/f/uploaded-1' });

    const store = useFileStore.getState();
    store.addFile({
      id: 'global-file',
      name: 'global.txt',
      size: 1,
      type: 'text/plain',
      uri: 'file:///global.txt',
    });
    store.addFile(
      {
        id: 'session-file',
        name: 'session.txt',
        size: 1,
        type: 'text/plain',
        uri: 'file:///session.txt',
      },
      { sessionId: 'session-1' },
    );

    const result = await useFileStore.getState().uploadFile('session-file', {
      sessionId: 'session-1',
    });

    expect(result).toEqual({
      fileId: 'uploaded-1',
      url: 'https://example.com/f/uploaded-1',
    });
    expect(uploadMock).toHaveBeenCalledWith(
      'file:///session.txt',
      'session.txt',
      'text/plain',
      expect.objectContaining({
        onProgress: expect.any(Function),
      }),
    );
    expect(useFileStore.getState().pendingFiles[0]).toMatchObject({
      id: 'global-file',
      status: 'pending',
    });
    expect(useFileStore.getState().sessionPendingFiles['session-1']?.[0]).toMatchObject({
      fileId: 'uploaded-1',
      id: 'session-file',
      status: 'done',
    });
  });

  it('clearPending({ all: true }) clears both global and session buckets', () => {
    const store = useFileStore.getState();

    store.addFile({
      id: 'global-file',
      name: 'global.txt',
      size: 1,
      type: 'text/plain',
      uri: 'file:///global.txt',
    });
    store.addFile(
      {
        id: 'session-file',
        name: 'session.txt',
        size: 1,
        type: 'text/plain',
        uri: 'file:///session.txt',
      },
      { sessionId: 'session-1' },
    );

    useFileStore.getState().clearPending({ all: true });

    expect(useFileStore.getState().pendingFiles).toEqual([]);
    expect(useFileStore.getState().sessionPendingFiles).toEqual({});
  });
});
