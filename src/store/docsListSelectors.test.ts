import { describe, expect, it, vi } from 'vitest';

import { useGlobalStore } from '@/store/global';
import { DocumentSourceType, type LobeDocument } from '@/types/document';

import { initialState, type PageState } from './docs/initialState';
import { listSelectors } from './docs/slices/list/selectors';

const createDocument = ({
  id,
  metadata,
  sourceSetId = null,
  sourceType,
}: {
  id: string;
  metadata?: Record<string, unknown>;
  sourceSetId?: string | null;
  sourceType: DocumentSourceType;
}): LobeDocument => ({
  content: '# Document',
  createdAt: new Date('2026-03-28T00:00:00Z'),
  editorData: null,
  filename: `${id}.md`,
  fileType: 'custom/document',
  id,
  metadata: metadata ?? {},
  source: 'document',
  sourceSetId,
  sourceType,
  title: id,
  totalCharCount: 10,
  totalLineCount: 1,
  updatedAt: new Date('2026-03-28T00:00:00Z'),
});

const createState = (documents: LobeDocument[]): PageState => ({
  ...initialState,
  documents,
});

describe('listSelectors', () => {
  it('keeps file-backed docs visible in the docs list', () => {
    vi.spyOn(useGlobalStore, 'getState').mockReturnValue({
      status: { pagePageSize: 20 },
    } as any);

    const state = createState([
      createDocument({
        id: 'editor-doc',
        sourceType: DocumentSourceType.EDITOR,
      }),
      createDocument({
        id: 'file-doc',
        sourceType: DocumentSourceType.FILE,
      }),
      createDocument({
        id: 'table-doc',
        metadata: { pageKind: 'table' },
        sourceType: DocumentSourceType.FILE,
      }),
    ]);

    expect(
      listSelectors
        .getFilteredDocumentsSnapshotByKind('doc')(state)
        .items
        .map((doc) => doc.id),
    ).toEqual(['editor-doc', 'file-doc']);
    expect(listSelectors.getFilteredDocumentsSnapshotByKind('doc')(state).count).toBe(2);
  });

  it('still applies source-set filtering after including file-backed docs', () => {
    vi.spyOn(useGlobalStore, 'getState').mockReturnValue({
      status: { pagePageSize: 20 },
    } as any);

    const state = {
      ...createState([
        createDocument({
          id: 'doc-with-source-set',
          sourceSetId: 'ss_123',
          sourceType: DocumentSourceType.FILE,
        }),
        createDocument({
          id: 'doc-without-source-set',
          sourceType: DocumentSourceType.FILE,
        }),
      ]),
      showOnlyPagesWithoutSourceSet: true,
    };

    expect(
      listSelectors
        .getFilteredDocumentsSnapshotByKind('doc')(state)
        .items
        .map((doc) => doc.id),
    ).toEqual(['doc-without-source-set']);
  });
});
