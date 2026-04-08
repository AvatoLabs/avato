import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  addNotebookTableColumn,
  addNotebookTableRow,
  getNotebookTableEditorState,
  getNotebookTablePreview,
  isTableNotebookDocument,
  serializeNotebookTableEditor,
  updateNotebookTableCell,
  updateNotebookTableColumnName,
} from './notebookDocument';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('isTableNotebookDocument', () => {
  it('returns true for table pageKind metadata', () => {
    expect(
      isTableNotebookDocument({
        metadata: {
          pageKind: 'table',
        },
      }),
    ).toBe(true);
  });

  it('returns false for markdown docs and missing metadata', () => {
    expect(
      isTableNotebookDocument({
        metadata: {
          pageKind: 'markdown',
        },
      }),
    ).toBe(false);
    expect(isTableNotebookDocument(null)).toBe(false);
  });

  it('builds a filtered and sorted table preview from editorData', () => {
    expect(
      getNotebookTablePreview({
        editorData: {
          activeViewId: 'view_active',
          views: [
            {
              fields: [
                { id: 'field_name', name: 'Name' },
                { id: 'field_status', name: 'Status' },
                { id: 'field_done', name: 'Done' },
              ],
              filters: [{ fieldId: 'field_status', operator: 'equals', value: 'Active' }],
              hiddenFieldIds: ['field_done'],
              id: 'view_active',
              name: 'Active items',
              records: [
                {
                  cells: {
                    field_done: false,
                    field_name: 'Alpha',
                    field_status: 'Inactive',
                  },
                  id: 'record_alpha',
                },
                {
                  cells: {
                    field_done: true,
                    field_name: 'Bravo',
                    field_status: 'Active',
                  },
                  id: 'record_bravo',
                },
                {
                  cells: {
                    field_done: false,
                    field_name: 'Zeta',
                    field_status: 'Active',
                  },
                  id: 'record_zeta',
                },
              ],
              sorts: [{ direction: 'desc', fieldId: 'field_name' }],
            },
          ],
        },
        metadata: {
          pageKind: 'table',
        },
      }),
    ).toEqual({
      columns: [
        { id: 'field_name', name: 'Name' },
        { id: 'field_status', name: 'Status' },
      ],
      rows: [
        { cells: ['Zeta', 'Active'], id: 'record_zeta' },
        { cells: ['Bravo', 'Active'], id: 'record_bravo' },
      ],
      totalColumns: 2,
      totalRows: 2,
      viewName: 'Active items',
    });
  });

  it('returns null when table editorData is missing or invalid', () => {
    expect(
      getNotebookTablePreview({
        editorData: null,
        metadata: {
          pageKind: 'table',
        },
      }),
    ).toBeNull();
  });

  it('builds an editable table state from the active view', () => {
    expect(
      getNotebookTableEditorState({
        editorData: {
          activeViewId: 'view_active',
          views: [
            {
              fields: [
                { id: 'field_name', name: 'Name', type: 'text', width: 240 },
                { id: 'field_status', name: 'Status', type: 'text' },
              ],
              filters: [],
              hiddenFieldIds: [],
              id: 'view_active',
              name: 'Roadmap',
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
      }),
    ).toEqual({
      activeViewId: 'view_active',
      fields: [
        { id: 'field_name', name: 'Name', type: 'text', width: 240 },
        { id: 'field_status', name: 'Status', type: 'text' },
      ],
      rows: [
        {
          cells: {
            field_name: 'Alpha',
            field_status: 'Active',
          },
          id: 'record_alpha',
        },
      ],
      sourceEditorData: {
        activeViewId: 'view_active',
        views: [
          {
            fields: [
              { id: 'field_name', name: 'Name', type: 'text', width: 240 },
              { id: 'field_status', name: 'Status', type: 'text' },
            ],
            filters: [],
            hiddenFieldIds: [],
            id: 'view_active',
            name: 'Roadmap',
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
      viewName: 'Roadmap',
    });
  });

  it('adds rows and columns, updates cells, and serializes table editor state', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_710_000_000_000);
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const initial = getNotebookTableEditorState({
      editorData: {
        activeViewId: 'view_active',
        views: [
          {
            fields: [{ id: 'field_name', name: 'Name', type: 'text' }],
            filters: [],
            hiddenFieldIds: [],
            id: 'view_active',
            name: 'Projects',
            records: [
              {
                cells: {
                  field_name: 'Alpha',
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
    });

    expect(initial).not.toBeNull();
    if (!initial) return;

    const withColumn = addNotebookTableColumn(initial, 'Status');
    const nextFieldId = withColumn.fields.at(-1)?.id;

    expect(nextFieldId).toBeTruthy();

    const withRow = addNotebookTableRow(withColumn);
    const nextRowId = withRow.rows.at(-1)?.id;

    expect(nextRowId).toBeTruthy();
    if (!nextFieldId || !nextRowId) return;

    const renamed = updateNotebookTableColumnName(withRow, nextFieldId, 'State');
    const updated = updateNotebookTableCell(
      updateNotebookTableCell(renamed, 'record_alpha', nextFieldId, 'Active'),
      nextRowId,
      nextFieldId,
      'Queued',
    );

    const serialized = serializeNotebookTableEditor(updated);

    expect(serialized.markdown).toBe(
      ['| Name | State |', '| --- | --- |', '| Alpha | Active |', '|  | Queued |'].join('\n'),
    );
    expect(serialized.editorData).toEqual({
      activeViewId: 'view_active',
      views: [
        {
          fields: [
            { id: 'field_name', name: 'Name', type: 'text' },
            { id: nextFieldId, name: 'State', type: 'text', width: 200 },
          ],
          filters: [],
          hiddenFieldIds: [],
          id: 'view_active',
          name: 'Projects',
          records: [
            {
              cells: {
                field_name: 'Alpha',
                [nextFieldId]: 'Active',
              },
              id: 'record_alpha',
            },
            {
              cells: {
                field_name: '',
                [nextFieldId]: 'Queued',
              },
              id: nextRowId,
            },
          ],
          sorts: [],
        },
      ],
    });
  });
});
