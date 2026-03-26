import { utils, write } from 'xlsx';

const DEFAULT_FIRST_COLUMN_NAME = 'Name';
const DEFAULT_COLUMN_PREFIX = 'Column';
const DEFAULT_ROW_KEY_PREFIX = 'row';
const EXCEL_SHEET_NAME_MAX_LENGTH = 31;
const EXCEL_SHEET_NAME_INVALID_CHARS = /[:\\/?*[\]]/g;

export const DEFAULT_TABLE_COLUMNS = 5;
export const DEFAULT_TABLE_ROWS = 8;

export interface TableSheetColumn {
  key: string;
  name: string;
}

export interface TableSheetRow {
  [key: string]: string;
  id: string;
}

export interface TableSheetData {
  columns: TableSheetColumn[];
  rows: TableSheetRow[];
}

const createColumnKey = (index: number) => `column_${index + 1}`;

const createRowId = () =>
  `${DEFAULT_ROW_KEY_PREFIX}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const getDefaultTableColumnName = (index: number) =>
  index === 0 ? DEFAULT_FIRST_COLUMN_NAME : `${DEFAULT_COLUMN_PREFIX} ${index + 1}`;

const normalizeCellValue = (value?: string) => (value ?? '').replaceAll(/\r?\n/g, ' ').trim();

const escapeMarkdownCell = (value?: string) => normalizeCellValue(value).replaceAll('|', '\\|');

const unescapeMarkdownCell = (value: string) =>
  value.replaceAll('\\|', '|').replaceAll('&vert;', '|').trim();

const splitMarkdownRow = (line: string) => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  let isEscaped = false;

  for (const char of trimmed) {
    if (isEscaped) {
      current += char;
      isEscaped = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      isEscaped = true;
      continue;
    }

    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current.trim());

  return cells;
};

const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line);

const isDividerRow = (line: string) =>
  splitMarkdownRow(line).every((cell) => /^:?-{3,}:?$/.test(cell.replaceAll(' ', '')));

const createRows = (columns: TableSheetColumn[], rowCount: number) =>
  Array.from({ length: rowCount }, () => {
    const row: TableSheetRow = { id: createRowId() };

    for (const column of columns) {
      row[column.key] = '';
    }

    return row;
  });

const normalizeColumns = (headers: string[], fallbackCount = DEFAULT_TABLE_COLUMNS) => {
  const count = Math.max(headers.length, fallbackCount);

  return Array.from({ length: count }, (_, index) => ({
    key: createColumnKey(index),
    name: headers[index]?.trim() || getDefaultTableColumnName(index),
  }));
};

const normalizeRows = (columns: TableSheetColumn[], body: string[][]) => {
  if (body.length === 0) return createRows(columns, 1);

  return body.map((cells) => {
    const row: TableSheetRow = { id: createRowId() };

    for (const [index, column] of columns.entries()) {
      row[column.key] = unescapeMarkdownCell(cells[index] || '');
    }

    return row;
  });
};

const createFallbackRowsFromMarkdown = (markdown: string, columns: TableSheetColumn[]) => {
  const meaningfulLines = markdown
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (meaningfulLines.length === 0) return createRows(columns, DEFAULT_TABLE_ROWS);

  return meaningfulLines.map((line) => {
    const row: TableSheetRow = { id: createRowId() };

    for (const [index, column] of columns.entries()) {
      row[column.key] = index === 0 ? line : '';
    }

    return row;
  });
};

export const createDefaultTableSheet = (
  columnCount = DEFAULT_TABLE_COLUMNS,
  rowCount = DEFAULT_TABLE_ROWS,
): TableSheetData => {
  const columns = normalizeColumns(
    Array.from({ length: columnCount }, () => ''),
    columnCount,
  );

  return {
    columns,
    rows: createRows(columns, rowCount),
  };
};

export const createStarterTableMarkdown = (
  columnCount = DEFAULT_TABLE_COLUMNS,
  rowCount = DEFAULT_TABLE_ROWS,
) => {
  const sheet = createDefaultTableSheet(columnCount, rowCount);

  return serializeTableMarkdown(sheet);
};

export const parseMarkdownTable = (markdown?: string | null): TableSheetData => {
  const lines = (markdown || '').split('\n');
  const firstTableLineIndex = lines.findIndex(isTableLine);

  if (firstTableLineIndex === -1) {
    const fallbackColumns = normalizeColumns([DEFAULT_FIRST_COLUMN_NAME], 1);

    return {
      columns: fallbackColumns,
      rows: createFallbackRowsFromMarkdown(markdown || '', fallbackColumns),
    };
  }

  const tableLines: string[] = [];

  for (let index = firstTableLineIndex; index < lines.length; index += 1) {
    const line = lines[index];

    if (!isTableLine(line)) break;
    tableLines.push(line);
  }

  if (tableLines.length < 2 || !isDividerRow(tableLines[1])) {
    const fallbackColumns = normalizeColumns([DEFAULT_FIRST_COLUMN_NAME], 1);

    return {
      columns: fallbackColumns,
      rows: createFallbackRowsFromMarkdown(markdown || '', fallbackColumns),
    };
  }

  const headerCells = splitMarkdownRow(tableLines[0]).map(unescapeMarkdownCell);
  const bodyCells = tableLines.slice(2).map(splitMarkdownRow);
  const columns = normalizeColumns(headerCells, headerCells.length || DEFAULT_TABLE_COLUMNS);

  return {
    columns,
    rows: normalizeRows(columns, bodyCells),
  };
};

export const serializeTableMarkdown = ({ columns, rows }: TableSheetData) => {
  const normalizedColumns = columns.length > 0 ? columns : createDefaultTableSheet(1, 1).columns;
  const normalizedRows = rows.length > 0 ? rows : createRows(normalizedColumns, 1);

  return [
    `| ${normalizedColumns.map((column) => escapeMarkdownCell(column.name)).join(' | ')} |`,
    `| ${normalizedColumns.map(() => '---').join(' | ')} |`,
    ...normalizedRows.map(
      (row) =>
        `| ${normalizedColumns.map((column) => escapeMarkdownCell(row[column.key])).join(' | ')} |`,
    ),
  ].join('\n');
};

export const tableSheetToAoa = ({ columns, rows }: TableSheetData) => [
  columns.map((column) => column.name),
  ...rows.map((row) => columns.map((column) => row[column.key] || '')),
];

export const tableSheetToCsv = (sheet: TableSheetData) => {
  const worksheet = utils.aoa_to_sheet(tableSheetToAoa(sheet));

  return utils.sheet_to_csv(worksheet);
};

const getSafeSheetName = (title?: string) => {
  const fallback = 'Table';
  const sanitized = (title || fallback).replaceAll(EXCEL_SHEET_NAME_INVALID_CHARS, '').trim();

  return (sanitized || fallback).slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);
};

export const tableSheetToXlsxBase64 = (sheet: TableSheetData, title?: string) => {
  const workbook = utils.book_new();
  const worksheet = utils.aoa_to_sheet(tableSheetToAoa(sheet));

  utils.book_append_sheet(workbook, worksheet, getSafeSheetName(title));

  return write(workbook, { bookType: 'xlsx', type: 'base64' });
};
