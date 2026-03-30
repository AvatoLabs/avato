import i18n from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { read, utils } from 'xlsx';

import {
  duplicateTableView,
  normalizeTableCellValue,
  normalizeTableDocument,
  projectTableView,
  TABLE_DOCUMENT_VERSION,
  type TableDocumentState,
  tableDocumentToCsv,
  tableDocumentToMarkdown,
  tableDocumentToXlsxBase64,
} from './tableDocument';

const createTableDocument = (): TableDocumentState => ({
  activeViewId: 'view_1',
  version: TABLE_DOCUMENT_VERSION,
  views: [
    {
      fields: [
        { id: 'field_name', name: 'Name', type: 'text', width: 260 },
        { id: 'field_status', name: 'Status', type: 'text', width: 180 },
        { id: 'field_done', name: 'Done', type: 'checkbox', width: 140 },
      ],
      filters: [{ fieldId: 'field_status', id: 'filter_1', operator: 'equals', value: 'Active' }],
      hiddenFieldIds: ['field_done'],
      id: 'view_1',
      name: 'Active records',
      records: [
        {
          cells: {
            field_done: false,
            field_name: 'Alpha',
            field_status: 'Inactive',
          },
          id: 'record_1',
        },
        {
          cells: {
            field_done: true,
            field_name: 'Bravo',
            field_status: 'Active',
          },
          id: 'record_2',
        },
        {
          cells: {
            field_done: false,
            field_name: 'Zeta',
            field_status: 'Active',
          },
          id: 'record_3',
        },
      ],
      rowHeight: 'normal',
      sorts: [{ direction: 'desc', fieldId: 'field_name', id: 'sort_1' }],
      type: 'grid',
    },
  ],
});

describe('tableDocument', () => {
  it('projects the active view with filters, hidden fields, and sort order', () => {
    const projection = projectTableView(createTableDocument());

    expect(projection.fields.map((field) => field.name)).toEqual(['Name', 'Status']);
    expect(projection.records.map((record) => record.cells.field_name)).toEqual(['Zeta', 'Bravo']);
  });

  it('exports the active view to markdown, csv, and xlsx', () => {
    const table = createTableDocument();

    const markdown = tableDocumentToMarkdown(table, { activeViewOnly: true });
    expect(markdown).toContain('| Name | Status |');
    expect(markdown).not.toContain('Done');
    expect(markdown).toContain('| Zeta | Active |');
    expect(markdown).not.toContain('Alpha');

    const csv = tableDocumentToCsv(table, { activeViewOnly: true });
    expect(csv).toContain('Name,Status');
    expect(csv).not.toContain('Done');
    expect(csv).toContain('Zeta,Active');
    expect(csv).not.toContain('Alpha');

    const workbook = read(
      tableDocumentToXlsxBase64(table, 'Active records', { activeViewOnly: true }),
      {
        type: 'base64',
      },
    );
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json<(string | number)[]>(worksheet, {
      header: 1,
    });

    expect(workbook.SheetNames[0]).toBe('Active records');
    expect(rows[0]).toEqual(['Name', 'Status']);
    expect(rows[1]).toEqual(['Zeta', 'Active']);
    expect(rows[2]).toEqual(['Bravo', 'Active']);
  });

  it('normalizes checkbox values safely', () => {
    expect(normalizeTableCellValue('false', 'checkbox')).toBe(false);
    expect(normalizeTableCellValue('yes', 'checkbox')).toBe(true);
    expect(normalizeTableCellValue('', 'checkbox')).toBe(false);
  });

  it('duplicates the active sheet with independent data', () => {
    const table = duplicateTableView(createTableDocument());

    expect(table.views).toHaveLength(2);
    expect(table.activeViewId).not.toBe('view_1');
    expect(table.views[1]?.fields[0]?.id).not.toBe('field_name');
    expect(table.views[1]?.records[0]?.id).not.toBe('record_1');
    expect(table.views[1]?.records[0]?.cells[table.views[1]!.fields[0]!.id]).toBe('Alpha');
  });

  it('round-trips single-column markdown tables without falling back to plain text rows', () => {
    const table = normalizeTableDocument('| Name |\n| --- |\n| RealBug |');

    expect(table.views[0]?.fields).toHaveLength(1);
    expect(table.views[0]?.fields[0]?.name).toBe('Name');
    expect(table.views[0]?.records[0]?.cells[table.views[0]!.fields[0]!.id]).toBe('RealBug');
    expect(tableDocumentToMarkdown(table)).toContain('| RealBug |');
  });

  it('normalizes bugged auto-generated column names back to positional defaults', () => {
    const markdown = [
      '| Name | Column 2 | Column 6 | Column 1 | Column 3 | Column 4 | Column 5 |',
      '| --- | --- | --- | --- | --- | --- | --- |',
      '| Alpha | | | | | | |',
    ].join('\n');

    const table = normalizeTableDocument(markdown, {
      activeViewId: 'view_1',
      version: TABLE_DOCUMENT_VERSION,
      views: [
        {
          fields: [
            { id: 'field_1', name: 'Name', type: 'text', width: 260 },
            { id: 'field_2', name: 'Column 2', type: 'text', width: 180 },
            { id: 'field_3', name: 'Column 6', type: 'text', width: 180 },
            { id: 'field_4', name: 'Column 1', type: 'text', width: 180 },
            { id: 'field_5', name: 'Column 3', type: 'text', width: 180 },
            { id: 'field_6', name: 'Column 4', type: 'text', width: 180 },
            { id: 'field_7', name: 'Column 5', type: 'text', width: 180 },
          ],
          filters: [],
          hiddenFieldIds: [],
          id: 'view_1',
          name: 'Sheet 1',
          records: [
            {
              cells: {
                field_1: 'Alpha',
                field_2: '',
                field_3: '',
                field_4: '',
                field_5: '',
                field_6: '',
                field_7: '',
              },
              id: 'record_1',
            },
          ],
          rowHeight: 'normal',
          sorts: [],
          type: 'grid',
        },
      ],
    });

    expect(table.views[0]?.fields.map((field) => field.name)).toEqual([
      'Name',
      'Column 2',
      'Column 3',
      'Column 4',
      'Column 5',
      'Column 6',
      'Column 7',
    ]);
    expect(tableDocumentToMarkdown(table)).not.toContain('Column 1');
  });

  it('normalizes localized bugged auto-generated column names back to positional defaults', () => {
    const translateSpy = vi.spyOn(i18n, 't').mockImplementation((key, options) => {
      if (key === 'docEditor.table.defaultColumnName') {
        return `列 ${String(options?.index ?? '')}`.trim();
      }
      if (key === 'docEditor.table.primaryColumnName') return '名称';
      if (key === 'docEditor.table.sheetDefaultName') {
        return `表 ${String(options?.index ?? '')}`.trim();
      }
      if (key === 'docEditor.table.untitledFieldName') return '未命名字段';

      return String(options?.defaultValue ?? key);
    });

    try {
      const markdown = [
        '| 名称 | 列 2 | 列 6 | 列 1 | 列 3 | 列 4 | 列 5 |',
        '| --- | --- | --- | --- | --- | --- | --- |',
        '| Alpha | | | | | | |',
      ].join('\n');

      const table = normalizeTableDocument(markdown, {
        activeViewId: 'view_1',
        version: TABLE_DOCUMENT_VERSION,
        views: [
          {
            fields: [
              { id: 'field_1', name: '名称', type: 'text', width: 260 },
              { id: 'field_2', name: '列 2', type: 'text', width: 180 },
              { id: 'field_3', name: '列 6', type: 'text', width: 180 },
              { id: 'field_4', name: '列 1', type: 'text', width: 180 },
              { id: 'field_5', name: '列 3', type: 'text', width: 180 },
              { id: 'field_6', name: '列 4', type: 'text', width: 180 },
              { id: 'field_7', name: '列 5', type: 'text', width: 180 },
            ],
            filters: [],
            hiddenFieldIds: [],
            id: 'view_1',
            name: '表 1',
            records: [
              {
                cells: {
                  field_1: 'Alpha',
                  field_2: '',
                  field_3: '',
                  field_4: '',
                  field_5: '',
                  field_6: '',
                  field_7: '',
                },
                id: 'record_1',
              },
            ],
            rowHeight: 'normal',
            sorts: [],
            type: 'grid',
          },
        ],
      });

      expect(table.views[0]?.fields.map((field) => field.name)).toEqual([
        '名称',
        '列 2',
        '列 3',
        '列 4',
        '列 5',
        '列 6',
        '列 7',
      ]);
      expect(tableDocumentToMarkdown(table)).not.toContain('列 1');
    } finally {
      translateSpy.mockRestore();
    }
  });
});
