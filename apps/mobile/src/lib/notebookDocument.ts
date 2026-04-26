import type { NotebookDocument } from './api';

export function isTableNotebookDocument(
  document?: Pick<NotebookDocument, 'metadata'> | null,
): boolean {
  return document?.metadata?.pageKind === 'table';
}

interface TablePreviewField {
  id: string;
  name: string;
}

interface TablePreviewRow {
  cells: string[];
  id: string;
}

export interface NotebookTablePreview {
  columns: TablePreviewField[];
  rows: TablePreviewRow[];
  totalColumns: number;
  totalRows: number;
  viewName?: string;
}

export interface NotebookTableEditorField {
  id: string;
  name: string;
  type?: string;
  width?: number;
}

export interface NotebookTableEditorRow {
  cells: Record<string, string>;
  id: string;
}

export interface NotebookTableEditorState {
  activeViewId: string;
  fields: NotebookTableEditorField[];
  rows: NotebookTableEditorRow[];
  sourceEditorData: Record<string, unknown>;
  viewName?: string;
}

const TABLE_CONTEXT_ROW_LIMIT = 20;

type TableCellValue = boolean | string;

interface TableFilterCandidate {
  fieldId?: unknown;
  operator?: unknown;
  value?: unknown;
}

interface TableSortCandidate {
  direction?: unknown;
  fieldId?: unknown;
}

interface TableFieldCandidate {
  id?: unknown;
  name?: unknown;
}

interface TableRecordCandidate {
  cells?: unknown;
  id?: unknown;
}

interface TableViewCandidate {
  fields?: unknown;
  filters?: unknown;
  hiddenFieldIds?: unknown;
  id?: unknown;
  name?: unknown;
  records?: unknown;
  sorts?: unknown;
}

const asObject = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeCellText = (value: TableCellValue | undefined) => {
  if (typeof value === 'boolean') return value ? 'True' : 'False';
  return typeof value === 'string' ? value : '';
};

const toComparableNumber = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';

const createEditorId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const toPreviewFields = (value: unknown) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((field) => {
      const candidate = field as TableFieldCandidate;
      return typeof candidate?.id === 'string' && typeof candidate?.name === 'string'
        ? {
            id: candidate.id,
            name: candidate.name,
          }
        : null;
    })
    .filter((field): field is TablePreviewField => field !== null);
};

const filterRecords = (
  rows: TableRecordCandidate[],
  filters: TableFilterCandidate[],
) => {
  if (filters.length === 0) return rows;

  return rows.filter((row) => {
    const cells = asObject(row.cells);
    if (!cells) return false;

    return filters.every((filter) => {
      if (typeof filter.fieldId !== 'string' || typeof filter.operator !== 'string') return true;

      const rawValue = cells[filter.fieldId] as TableCellValue | undefined;
      const cellValue = normalizeCellText(rawValue);
      const expectedValue = normalizeText(filter.value);

      switch (filter.operator) {
        case 'contains': {
          return cellValue.toLowerCase().includes(expectedValue.toLowerCase());
        }
        case 'equals': {
          return cellValue === expectedValue;
        }
        case 'notEquals': {
          return cellValue !== expectedValue;
        }
        case 'isEmpty': {
          return cellValue.trim().length === 0;
        }
        case 'isNotEmpty': {
          return cellValue.trim().length > 0;
        }
        case 'greaterThan': {
          const left = toComparableNumber(cellValue);
          const right = toComparableNumber(expectedValue);
          if (left !== null && right !== null) return left > right;
          return cellValue.localeCompare(expectedValue) > 0;
        }
        case 'lessThan': {
          const left = toComparableNumber(cellValue);
          const right = toComparableNumber(expectedValue);
          if (left !== null && right !== null) return left < right;
          return cellValue.localeCompare(expectedValue) < 0;
        }
        default: {
          return true;
        }
      }
    });
  });
};

const sortRecords = (rows: TableRecordCandidate[], sorts: TableSortCandidate[]) => {
  if (sorts.length === 0) return rows;

  return [...rows].sort((leftRow, rightRow) => {
    const leftCells = asObject(leftRow.cells);
    const rightCells = asObject(rightRow.cells);

    for (const sort of sorts) {
      if (typeof sort.fieldId !== 'string') continue;

      const leftValue = normalizeCellText(leftCells?.[sort.fieldId] as TableCellValue | undefined);
      const rightValue = normalizeCellText(
        rightCells?.[sort.fieldId] as TableCellValue | undefined,
      );

      const leftNumber = toComparableNumber(leftValue);
      const rightNumber = toComparableNumber(rightValue);
      const direction = sort.direction === 'desc' ? -1 : 1;

      const result =
        leftNumber !== null && rightNumber !== null
          ? leftNumber === rightNumber
            ? 0
            : leftNumber > rightNumber
              ? 1
              : -1
          : leftValue.localeCompare(rightValue);

      if (result !== 0) return result * direction;
    }

    return 0;
  });
};

const getTableViewCandidate = (document?: Pick<NotebookDocument, 'editorData' | 'metadata'> | null) => {
  if (!isTableNotebookDocument(document)) return null;

  const editorData = asObject(document?.editorData);
  const activeViewId = typeof editorData?.activeViewId === 'string' ? editorData.activeViewId : null;
  const views = Array.isArray(editorData?.views)
    ? (editorData.views as TableViewCandidate[])
    : [];

  const view =
    views.find((candidate) => candidate?.id === activeViewId) ??
    views.find((candidate) => asObject(candidate) !== null);

  if (!editorData || !view || typeof view.id !== 'string') return null;

  return { editorData, view };
};

export function getNotebookTablePreview(
  document?: Pick<NotebookDocument, 'editorData' | 'metadata'> | null,
): NotebookTablePreview | null {
  const resolved = getTableViewCandidate(document);
  if (!resolved) return null;
  const { view } = resolved;

  const allFields = toPreviewFields(view.fields);
  if (allFields.length === 0) return null;

  const hiddenFieldIds = new Set(
    Array.isArray(view.hiddenFieldIds)
      ? view.hiddenFieldIds.filter((value): value is string => typeof value === 'string')
      : [],
  );
  const columns = allFields.filter((field) => !hiddenFieldIds.has(field.id));
  const effectiveColumns = columns.length > 0 ? columns : allFields;

  const rawRows = Array.isArray(view.records) ? (view.records as TableRecordCandidate[]) : [];
  const filters = Array.isArray(view.filters) ? (view.filters as TableFilterCandidate[]) : [];
  const sorts = Array.isArray(view.sorts) ? (view.sorts as TableSortCandidate[]) : [];

  const rows = sortRecords(filterRecords(rawRows, filters), sorts)
    .map((row, index) => {
      const cells = asObject(row.cells);
      if (!cells) return null;

      return {
        cells: effectiveColumns.map((field) =>
          normalizeCellText(cells[field.id] as TableCellValue | undefined),
        ),
        id: typeof row.id === 'string' ? row.id : `row-${index}`,
      };
    })
    .filter((row): row is TablePreviewRow => row !== null);

  return {
    columns: effectiveColumns,
    rows,
    totalColumns: effectiveColumns.length,
    totalRows: rows.length,
    viewName: typeof view.name === 'string' ? view.name : undefined,
  };
}

export function getNotebookTableEditorState(
  document?: Pick<NotebookDocument, 'editorData' | 'metadata'> | null,
): NotebookTableEditorState | null {
  const resolved = getTableViewCandidate(document);
  if (!resolved) return null;

  const { editorData, view } = resolved;
  const fields = Array.isArray(view.fields)
    ? (view.fields as TableFieldCandidate[])
        .map((field) => {
          const candidate = field as TableFieldCandidate & { type?: unknown; width?: unknown };
          return typeof candidate.id === 'string' && typeof candidate.name === 'string'
            ? {
                id: candidate.id,
                name: candidate.name,
                ...(typeof candidate.type === 'string' ? { type: candidate.type } : {}),
                ...(typeof candidate.width === 'number' ? { width: candidate.width } : {}),
              }
            : null;
        })
        .filter((field): field is NotebookTableEditorField => field !== null)
    : [];

  if (fields.length === 0) return null;

  const rows = Array.isArray(view.records)
    ? (view.records as TableRecordCandidate[]).map((row, index) => {
        const cells = asObject(row.cells) ?? {};

        return {
          cells: Object.fromEntries(
            fields.map((field) => [
              field.id,
              normalizeCellText(cells[field.id] as TableCellValue | undefined),
            ]),
          ),
          id: typeof row.id === 'string' ? row.id : `row_${index}`,
        };
      })
    : [];

  return {
    activeViewId: view.id as string,
    fields,
    rows,
    sourceEditorData: structuredClone(editorData),
    ...(typeof view.name === 'string' ? { viewName: view.name } : {}),
  };
}

export function addNotebookTableRow(editor: NotebookTableEditorState): NotebookTableEditorState {
  return {
    ...editor,
    rows: [
      ...editor.rows,
      {
        cells: Object.fromEntries(editor.fields.map((field) => [field.id, ''])),
        id: createEditorId('record'),
      },
    ],
  };
}

export function addNotebookTableColumn(
  editor: NotebookTableEditorState,
  name: string,
): NotebookTableEditorState {
  const trimmedName = name.trim();
  const nextField: NotebookTableEditorField = {
    id: createEditorId('field'),
    name: trimmedName || `Column ${editor.fields.length + 1}`,
    type: 'text',
    width: 200,
  };

  return {
    ...editor,
    fields: [...editor.fields, nextField],
    rows: editor.rows.map((row) => ({
      ...row,
      cells: {
        ...row.cells,
        [nextField.id]: '',
      },
    })),
  };
}

export function updateNotebookTableColumnName(
  editor: NotebookTableEditorState,
  fieldId: string,
  name: string,
): NotebookTableEditorState {
  return {
    ...editor,
    fields: editor.fields.map((field) =>
      field.id === fieldId ? { ...field, name } : field,
    ),
  };
}

export function updateNotebookTableCell(
  editor: NotebookTableEditorState,
  rowId: string,
  fieldId: string,
  value: string,
): NotebookTableEditorState {
  return {
    ...editor,
    rows: editor.rows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            cells: {
              ...row.cells,
              [fieldId]: value,
            },
          }
        : row,
    ),
  };
}

export function serializeNotebookTableEditor(editor: NotebookTableEditorState): {
  editorData: Record<string, unknown>;
  markdown: string;
} {
  const nextView = {
    ...(
      Array.isArray(editor.sourceEditorData.views)
        ? (editor.sourceEditorData.views as TableViewCandidate[]).find(
            (view) => view?.id === editor.activeViewId,
          ) || {}
        : {}
    ),
    fields: editor.fields.map((field) => ({
      ...(field.type ? { type: field.type } : {}),
      ...(field.width ? { width: field.width } : {}),
      id: field.id,
      name: field.name.trim() || 'Untitled',
    })),
    id: editor.activeViewId,
    records: editor.rows.map((row) => ({
      cells: Object.fromEntries(
        editor.fields.map((field) => [field.id, row.cells[field.id] ?? '']),
      ),
      id: row.id,
    })),
  };

  const sourceViews = Array.isArray(editor.sourceEditorData.views)
    ? (editor.sourceEditorData.views as TableViewCandidate[])
    : [];
  const nextViews =
    sourceViews.length === 0
      ? [nextView]
      : sourceViews.map((view) => (view?.id === editor.activeViewId ? nextView : view));

  const editorData = {
    ...editor.sourceEditorData,
    activeViewId: editor.activeViewId,
    views: nextViews,
  };

  const header = `| ${editor.fields.map((field) => escapeMarkdownCell(field.name.trim() || 'Untitled')).join(' | ')} |`;
  const divider = `| ${editor.fields.map(() => '---').join(' | ')} |`;
  const body = editor.rows.map(
    (row) =>
      `| ${editor.fields
        .map((field) => escapeMarkdownCell(row.cells[field.id] ?? ''))
        .join(' | ')} |`,
  );

  return {
    editorData,
    markdown: [header, divider, ...body].join('\n'),
  };
}

const escapeMarkdownCell = (value: string) => value.replaceAll('|', '\\|').replaceAll('\n', ' ');

export function getNotebookTableContextContent(
  document?: Pick<NotebookDocument, 'editorData' | 'metadata' | 'title'> | null,
): string | null {
  const preview = getNotebookTablePreview(document);
  if (!preview) return null;

  const visibleRows = preview.rows.slice(0, TABLE_CONTEXT_ROW_LIMIT);
  const header = `| ${preview.columns.map((column) => escapeMarkdownCell(column.name)).join(' | ')} |`;
  const divider = `| ${preview.columns.map(() => '---').join(' | ')} |`;
  const body = visibleRows.map(
    (row) => `| ${row.cells.map((cell) => escapeMarkdownCell(cell)).join(' | ')} |`,
  );
  const truncatedCount = preview.totalRows - visibleRows.length;

  return [
    document?.title?.trim() ? `Table: ${document.title.trim()}` : null,
    preview.viewName ? `View: ${preview.viewName}` : null,
    `Columns: ${preview.totalColumns}`,
    `Rows: ${preview.totalRows}`,
    '',
    header,
    divider,
    ...body,
    truncatedCount > 0 ? '' : null,
    truncatedCount > 0 ? `... ${truncatedCount} more rows` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
