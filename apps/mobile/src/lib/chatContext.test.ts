import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildDocContextDisplayText,
  buildDocContextPromptText,
  createChatContextSelectionFromResource,
  isChatContextEligibleResource,
  toDocSelections,
} from './chatContext';

const { fileApi, notebookApi, resourceApi } = vi.hoisted(() => ({
  fileApi: {
    getFileContents: vi.fn(),
  },
  notebookApi: {
    get: vi.fn(),
  },
  resourceApi: {
    ensureFileDocument: vi.fn(),
    previewFileContent: vi.fn(),
  },
}));

vi.mock('./api', () => ({
  fileApi,
  notebookApi,
  resourceApi,
}));

describe('chatContext helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds canonical document contexts from notebook documents', async () => {
    notebookApi.get.mockResolvedValueOnce({
      content: '# Product Spec\nCore content',
      id: 'docs_123',
      metadata: {
        pageKind: 'markdown',
      },
      title: 'Product Spec',
    });

    await expect(
      createChatContextSelectionFromResource({
        fileType: 'custom/page',
        id: 'docs_123',
        name: 'Product Spec',
        sourceType: 'document',
      }),
    ).resolves.toEqual({
      content: '# Product Spec\nCore content',
      docId: 'docs_123',
      format: 'markdown',
      id: 'document-context-docs_123',
      preview: 'Product Spec',
      title: 'Product Spec',
      type: 'text',
    });
  });

  it('serializes table notebook documents into chat context content', async () => {
    notebookApi.get.mockResolvedValueOnce({
      id: 'docs_table_1',
      editorData: {
        activeViewId: 'view_active',
        views: [
          {
            fields: [
              { id: 'field_name', name: 'Name' },
              { id: 'field_status', name: 'Status' },
            ],
            filters: [],
            hiddenFieldIds: [],
            id: 'view_active',
            name: 'Active view',
            records: [
              {
                cells: {
                  field_name: 'Alpha',
                  field_status: 'Active',
                },
                id: 'record_alpha',
              },
            ],
            sorts: [],
          },
        ],
      },
      metadata: {
        pageKind: 'table',
      },
      title: 'Quarterly Sheet',
    });

    await expect(
      createChatContextSelectionFromResource({
        fileType: 'custom/page',
        id: 'docs_table_1',
        name: 'Quarterly Sheet',
        sourceType: 'document',
      }),
    ).resolves.toEqual({
      content: [
        'Table: Quarterly Sheet',
        'View: Active view',
        'Columns: 2',
        'Rows: 1',
        '',
        '| Name | Status |',
        '| --- | --- |',
        '| Alpha | Active |',
      ].join('\n'),
      docId: 'docs_table_1',
      format: 'markdown',
      id: 'document-context-docs_table_1',
      preview: 'Quarterly Sheet',
      title: 'Quarterly Sheet',
      type: 'text',
    });
  });

  it('treats canonical documents and markdown files as chat-context eligible', () => {
    expect(
      isChatContextEligibleResource({
        fileType: 'custom/page',
        id: 'docs_123',
        name: 'Product Spec',
        sourceType: 'document',
      }),
    ).toBe(true);

    expect(
      isChatContextEligibleResource({
        fileType: 'application/pdf',
        id: 'docs_derived_1',
        name: 'Spec.pdf',
        sourceType: 'file',
      }),
    ).toBe(true);

    expect(
      isChatContextEligibleResource({
        fileType: 'text/markdown',
        id: 'file_123',
        name: 'notes.md',
        sourceType: 'file',
      }),
    ).toBe(true);

    expect(
      isChatContextEligibleResource({
        fileType: 'application/pdf',
        id: 'file_456',
        name: 'deck.pdf',
        sourceType: 'file',
      }),
    ).toBe(false);
  });

  it('converts context selections into doc selections and prompt/display text', () => {
    const contexts = [
      {
        content: 'Alpha content',
        docId: 'docs_alpha',
        id: 'document-context-docs_alpha',
        preview: 'Alpha',
        title: 'Alpha',
        type: 'text' as const,
      },
      {
        content: 'Beta content',
        docId: 'docs_beta',
        id: 'document-context-docs_beta',
        preview: 'Beta',
        title: 'Beta',
        type: 'text' as const,
      },
    ];

    expect(toDocSelections(contexts)).toEqual([
      {
        content: 'Alpha content',
        docId: 'docs_alpha',
        id: 'document-context-docs_alpha',
        xml: 'Alpha content',
      },
      {
        content: 'Beta content',
        docId: 'docs_beta',
        id: 'document-context-docs_beta',
        xml: 'Beta content',
      },
    ]);

    expect(buildDocContextDisplayText(contexts)).toBe('- Alpha\n- Beta');
    expect(buildDocContextPromptText(contexts)).toContain('- Alpha:\nAlpha content');
    expect(buildDocContextPromptText(contexts)).toContain('- Beta:\nBeta content');
  });
});
