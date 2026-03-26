import { describe, expect, it } from 'vitest';
import { read, utils } from 'xlsx';

import {
  duplicateTableView,
  normalizeTableCellValue,
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
});
