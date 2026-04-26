import { beforeEach, describe, expect, it, vi } from 'vitest';

import { documentService } from '@/services/document';
import { getPageDetailPath } from '@/utils/docs';

import { createStore } from './index';

const {
  documentStoreState,
  pageStoreState,
  useDocumentStoreMock,
  useFileStoreMock,
  usePageStoreMock,
} = vi.hoisted(() => {
  const documentState = {
    documents: {} as Record<string, unknown>,
    performSave: vi.fn(),
  };

  return {
    documentStoreState: documentState,
    pageStoreState: {
      documents: [] as any[],
    },
    useDocumentStoreMock: Object.assign(vi.fn(), {
      getState: vi.fn(() => documentState),
    }),
    useFileStoreMock: Object.assign(vi.fn(), {
      getState: vi.fn(() => ({
        removeDocument: vi.fn(),
      })),
    }),
    usePageStoreMock: Object.assign(vi.fn(), {
      getState: vi.fn(() => ({
        documents: pageStoreState.documents,
      })),
    }),
  };
});

vi.mock('@/services/document', () => ({
  documentService: {
    getDocumentById: vi.fn(),
    updateDocument: vi.fn(),
  },
}));

vi.mock('@/store/document', () => ({
  useDocumentStore: useDocumentStoreMock,
}));

vi.mock('@/store/file', () => ({
  useFileStore: useFileStoreMock,
}));

vi.mock('@/store/docs', () => ({
  usePageStore: usePageStoreMock,
}));

vi.mock('@/utils/docs', () => ({
  DEFAULT_PAGE_KIND: 'doc',
  getPageDetailPath: vi.fn(),
  getPageKindFromDocument: vi.fn(() => 'doc'),
}));

describe('PageEditor meta save', () => {
  beforeEach(() => {
    documentStoreState.documents = {};
    documentStoreState.performSave.mockReset().mockResolvedValue(undefined);
    pageStoreState.documents = [];
    vi.mocked(getPageDetailPath).mockReset().mockReturnValue('/pages/doc-1');
    vi.mocked(documentService.getDocumentById).mockReset().mockResolvedValue(undefined);
    vi.mocked(documentService.updateDocument).mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('falls back to direct document updates when the document store is not hydrated yet', async () => {
    const onTitleChange = vi.fn();
    const store = createStore({
      documentId: 'doc-1',
      isMetaDirty: true,
      lastSavedTitle: 'Old title',
      onTitleChange,
      title: 'New title',
    });

    await store.getState().performMetaSave();

    expect(documentStoreState.performSave).not.toHaveBeenCalled();
    expect(documentService.updateDocument).toHaveBeenCalledWith({
      id: 'doc-1',
      title: 'New title',
    });
    expect(onTitleChange).toHaveBeenCalledWith('New title');
    expect(store.getState().lastSavedTitle).toBe('New title');
    expect(store.getState().isMetaDirty).toBe(false);
  });

  it('removes emoji from persisted metadata instead of sending the stale value back', async () => {
    pageStoreState.documents = [
      {
        id: 'doc-1',
        metadata: {
          emoji: '📄',
          pageKind: 'table',
        },
      },
    ];
    documentStoreState.documents = {
      'doc-1': {
        isDirty: false,
      },
    };

    const onEmojiChange = vi.fn();
    const store = createStore({
      documentId: 'doc-1',
      emoji: undefined,
      isMetaDirty: true,
      lastSavedEmoji: '📄',
      onEmojiChange,
      title: 'Untitled',
    });

    await store.getState().performMetaSave();

    expect(documentStoreState.performSave).toHaveBeenCalledWith('doc-1', {
      metadata: {
        pageKind: 'table',
      },
      title: 'Untitled',
    });
    expect(onEmojiChange).toHaveBeenCalledWith(undefined);
  });

  it('loads remote metadata before saving emoji changes without a local page snapshot', async () => {
    vi.mocked(documentService.getDocumentById).mockResolvedValue({
      content: '',
      createdAt: new Date(),
      editorData: null,
      fileType: 'text/markdown',
      id: 'doc-1',
      metadata: {
        pageKind: 'doc',
        source: 'remote',
      },
      title: 'Untitled',
      updatedAt: new Date(),
    } as any);

    const store = createStore({
      documentId: 'doc-1',
      emoji: '✨',
      isMetaDirty: true,
      lastSavedEmoji: undefined,
      title: 'Untitled',
    });

    await store.getState().performMetaSave();

    expect(documentService.getDocumentById).toHaveBeenCalledWith('doc-1');
    expect(documentService.updateDocument).toHaveBeenCalledWith({
      id: 'doc-1',
      metadata: {
        emoji: '✨',
        pageKind: 'doc',
        source: 'remote',
      },
      title: 'Untitled',
    });
  });

  it('rethrows meta save failures so route leave can be blocked', async () => {
    documentStoreState.documents = {
      'doc-1': {
        isDirty: false,
      },
    };
    documentStoreState.performSave.mockRejectedValueOnce(new Error('meta save failed'));

    const store = createStore({
      documentId: 'doc-1',
      isMetaDirty: true,
      title: 'Untitled',
    });

    await expect(store.getState().performMetaSave()).rejects.toThrow('meta save failed');
    expect(store.getState().metaSaveStatus).toBe('idle');
  });

  it('shows success only after the page link is copied', async () => {
    pageStoreState.documents = [
      {
        id: 'doc-1',
        spaceId: 'spc_1',
      },
    ];

    const message = {
      error: vi.fn(),
      success: vi.fn(),
    };
    const writeText = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const store = createStore({
      documentId: 'doc-1',
    });

    await store.getState().handleCopyLink((key) => key, message);

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/pages/doc-1`);
    expect(message.success).toHaveBeenCalledWith('docEditor.linkCopied');
    expect(message.error).not.toHaveBeenCalled();
  });

  it('shows an error when copying the page link fails', async () => {
    pageStoreState.documents = [
      {
        id: 'doc-1',
        spaceId: 'spc_1',
      },
    ];

    const message = {
      error: vi.fn(),
      success: vi.fn(),
    };
    const copyError = new Error('clipboard blocked');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const writeText = vi.fn().mockRejectedValue(copyError);

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const store = createStore({
      documentId: 'doc-1',
    });

    await store.getState().handleCopyLink((key) => key, message);

    expect(message.success).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith('docEditor.linkCopyError');
    expect(consoleErrorSpy).toHaveBeenCalledWith('[PageEditor] Failed to copy link:', copyError);

    consoleErrorSpy.mockRestore();
  });
});
