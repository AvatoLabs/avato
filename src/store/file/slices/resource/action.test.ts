import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { documentService } from '@/services/document';
import { useFileStore } from '@/store/file/store';
import { DocumentSourceType, type LobeDocument } from '@/types/document';
import { type ResourceItem } from '@/types/resource';

vi.mock('zustand/traditional');

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

vi.mock('@/store/page/store', () => ({
  usePageStore: {
    getState: () => pageStoreState,
    setState: pageStoreSetState,
  },
}));

vi.mock('@/store/page/slices/list/action', () => ({
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

const buildResource = (id: string): ResourceItem => ({
  createdAt: new Date('2026-03-27T00:00:00.000Z'),
  fileType: 'custom/document',
  id,
  name: 'Test Document',
  size: 0,
  sourceType: 'document',
  updatedAt: new Date('2026-03-27T00:00:00.000Z'),
});

describe('ResourceAction deleteResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const document = buildDocument('docs_test');
    const resource = buildResource('docs_test');

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
    const deleteDocumentsSpy = vi
      .spyOn(documentService, 'deleteDocuments')
      .mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveDelete = resolve;
          }),
      );

    const { result } = renderHook(() => useFileStore());

    let settled = false;
    const deletionPromise = result.current.deleteResources(['docs_test']).then(() => {
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
});
