import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { documentService } from '@/services/document';
import { useFileStore } from '@/store/file/store';
import { type ContentItem } from '@/types/content';
import { DocumentSourceType, type LobeDocument } from '@/types/document';

vi.mock('zustand/traditional');
vi.mock('@/components/AntdStaticMethods', () => ({
  notification: {
    destroy: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const pageStoreState = vi.hoisted(() => ({
  documents: [] as LobeDocument[] | undefined,
  selectedPageId: null as string | null,
}));

const pageStoreSetState = vi.hoisted(() =>
  vi.fn((partial: any) => {
    const nextValue = typeof partial === 'function' ? partial(pageStoreState) : partial;
    Object.assign(pageStoreState, nextValue);
  }),
);

const removePageDocumentsFromCache = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@/libs/swr', async () => {
  const actual = await vi.importActual('@/libs/swr');
  return {
    ...actual,
    mutate: vi.fn(),
  };
});

vi.mock('@/store/docs/store', () => ({
  usePageStore: {
    getState: () => pageStoreState,
    setState: pageStoreSetState,
  },
}));

vi.mock('@/store/docs/slices/list/action', () => ({
  removePageDocumentsFromCache,
}));

const buildDocument = (id: string): LobeDocument => ({
  content: '',
  createdAt: new Date('2026-03-27T00:00:00.000Z'),
  editorData: null,
  fileType: 'custom/document',
  filename: 'Test Document',
  id,
  metadata: {},
  source: 'document',
  sourceType: DocumentSourceType.EDITOR,
  title: 'Test Document',
  totalCharCount: 0,
  totalLineCount: 0,
  updatedAt: new Date('2026-03-27T00:00:00.000Z'),
});

const buildContentItem = (
  id: string,
  sourceType: 'file' | 'document' = 'document',
): ContentItem => ({
  createdAt: new Date('2026-03-27T00:00:00.000Z'),
  fileType: 'custom/document',
  id,
  name: 'Test Document',
  size: 0,
  sourceType,
  updatedAt: new Date('2026-03-27T00:00:00.000Z'),
});

describe('ResourceAction deleteContentItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const document = buildDocument('docs_test');
    const resource = buildContentItem('docs_test');

    useFileStore.setState(
      {
        documents: [document],
        localDocumentMap: new Map([[document.id, document]]),
        resourceList: [resource],
        resourceMap: new Map([[resource.id, resource]]),
      },
      false,
    );

    pageStoreState.documents = [document];
    pageStoreState.selectedPageId = document.id;
    pageStoreSetState.mockClear();
    removePageDocumentsFromCache.mockClear();
  });

  it('waits for backend deletion before resolving and then syncs page store', async () => {
    let resolveDelete!: () => void;
    const deleteDocumentsSpy = vi.spyOn(documentService, 'deleteDocuments').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const { result } = renderHook(() => useFileStore());

    let settled = false;
    const deletionPromise = result.current.deleteContentItems(['docs_test']).then(() => {
      settled = true;
    });

    await Promise.resolve();

    expect(deleteDocumentsSpy).toHaveBeenCalledWith(['docs_test'], true);
    expect(settled).toBe(false);
    expect(useFileStore.getState().resourceList).toHaveLength(0);
    expect(pageStoreState.documents).toHaveLength(1);

    resolveDelete();

    await act(async () => {
      await deletionPromise;
    });

    expect(settled).toBe(true);
    expect(pageStoreState.documents).toHaveLength(0);
    expect(pageStoreState.selectedPageId).toBeNull();
    expect(removePageDocumentsFromCache).toHaveBeenCalledWith(['docs_test']);
  });

  it('treats docs_* file-backed resources as documents during optimistic delete', async () => {
    const document = buildDocument('docs_backed');
    const resource = buildContentItem('docs_backed', 'file');

    useFileStore.setState(
      {
        documents: [document],
        localDocumentMap: new Map([[document.id, document]]),
        resourceList: [resource],
        resourceMap: new Map([[resource.id, resource]]),
      },
      false,
    );
    pageStoreState.documents = [document];
    pageStoreState.selectedPageId = document.id;

    let resolveDelete!: () => void;
    const deleteDocumentsSpy = vi.spyOn(documentService, 'deleteDocuments').mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        }),
    );

    const { result } = renderHook(() => useFileStore());

    let settled = false;
    const deletionPromise = result.current.deleteContentItems(['docs_backed']).then(() => {
      settled = true;
    });

    await Promise.resolve();

    expect(deleteDocumentsSpy).toHaveBeenCalledWith(['docs_backed'], true);
    expect(settled).toBe(false);
    expect(useFileStore.getState().documents).toHaveLength(0);
    expect(useFileStore.getState().localDocumentMap.size).toBe(0);
    expect(useFileStore.getState().resourceList).toHaveLength(0);
    expect(pageStoreState.documents).toHaveLength(1);

    resolveDelete();

    await act(async () => {
      await deletionPromise;
    });

    expect(settled).toBe(true);
    expect(pageStoreState.documents).toHaveLength(0);
    expect(pageStoreState.selectedPageId).toBeNull();
    expect(removePageDocumentsFromCache).toHaveBeenCalledWith(['docs_backed']);
  });
});
