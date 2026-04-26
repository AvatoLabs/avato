import { describe, expect, it } from 'vitest';
import { read, utils } from 'xlsx';

import {
  createStarterTableMarkdown,
  parseMarkdownTable,
  serializeTableMarkdown,
  tableSheetToCsv,
  tableSheetToXlsxBase64,
} from './docsTable';

describe('pageTable', () => {
  it('should create a notion-like starter markdown table', () => {
    const markdown = createStarterTableMarkdown(3, 2);

    expect(markdown).toContain('| Name | Column 2 | Column 3 |');
    expect(markdown.split('\n')).toHaveLength(4);
  });

  it('should round-trip markdown tables', () => {
    const markdown = `| Name | Status |
| --- | --- |
| Launch | In review |
| Polish | Done |`;

    const sheet = parseMarkdownTable(markdown);

    expect(sheet.columns.map((column) => column.name)).toEqual(['Name', 'Status']);
    expect(sheet.rows.map((row) => row.column_1)).toEqual(['Launch', 'Polish']);
    expect(sheet.rows.map((row) => row.column_2)).toEqual(['In review', 'Done']);
    expect(serializeTableMarkdown(sheet)).toBe(markdown);
  });

  it('should fallback plain text into a single-column sheet', () => {
    const sheet = parseMarkdownTable('Alpha\nBeta');

    expect(sheet.columns).toHaveLength(1);
    expect(sheet.columns[0]?.name).toBe('Name');
    expect(sheet.rows.map((row) => row.column_1)).toEqual(['Alpha', 'Beta']);
  });

  it('should parse markdown tables with short alignment markers and optional trailing pipes', () => {
    const sheet = parseMarkdownTable(`| 名称 | 状态
| :- | :-:
| 启动 | 进行中
| 发布 | 已完成`);

    expect(sheet.columns.map((column) => column.name)).toEqual(['名称', '状态']);
    expect(sheet.rows.map((row) => row.column_1)).toEqual(['启动', '发布']);
    expect(sheet.rows.map((row) => row.column_2)).toEqual(['进行中', '已完成']);
  });

  it('should export csv and xlsx from sheet data', () => {
    const sheet = parseMarkdownTable(`| Name | Owner |
| --- | --- |
| Roadmap | Arthur |`);

    expect(tableSheetToCsv(sheet)).toContain('Name,Owner');
    expect(tableSheetToCsv(sheet)).toContain('Roadmap,Arthur');

    const workbook = read(tableSheetToXlsxBase64(sheet, 'Quarterly Plan'), { type: 'base64' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json<(string | number)[]>(worksheet, {
      header: 1,
    });

    expect(workbook.SheetNames[0]).toBe('Quarterly Plan');
    expect(rows[0]).toEqual(['Name', 'Owner']);
    expect(rows[1]).toEqual(['Roadmap', 'Arthur']);
  });
});
