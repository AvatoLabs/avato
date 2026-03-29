/**
 * @vitest-environment happy-dom
 */
import { EDITOR_MAX_WAIT } from '@lobechat/const';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DocsTableTypes from '@/utils/docsTable';

import {
  type TableDocumentState,
  tableDocumentToMarkdown,
  type TableFieldType,
} from '../../../utils/tableDocument';
import TableSheet from './index';

interface MockDocument {
  id: string;
  metadata?: {
    table?: TableDocumentState;
  };
}

interface TestFieldConfig {
  name: string;
  type?: TableFieldType;
}

const {
  documentStoreState,
  pageEditorState,
  pageStoreState,
  useDocumentStoreMock,
  usePageEditorStoreMock,
  usePageStoreMock,
} = vi.hoisted(() => {
  const documentState = {
    performSave: vi.fn(),
  };

  const storeState = {
    documents: [] as MockDocument[],
    internal_dispatchDocuments: vi.fn(),
  };

  return {
    documentStoreState: documentState,
    pageEditorState: {
      documentId: 'doc-1',
    },
    pageStoreState: storeState,
    useDocumentStoreMock: Object.assign(vi.fn(), {
      getState: vi.fn(() => documentState),
    }),
    usePageEditorStoreMock: vi.fn((selector: (state: typeof pageEditorState) => unknown) =>
      selector(pageEditorState),
    ),
    usePageStoreMock: Object.assign(
      vi.fn((selector: (state: typeof storeState) => unknown) => selector(storeState)),
      {
        getState: vi.fn(() => storeState),
      },
    ),
  };
});

vi.mock('i18next', () => {
  const t = (key: string, options?: Record<string, unknown>) => {
    if (key === 'docEditor.table.defaultColumnName') {
      return `Column ${String(options?.index ?? '')}`.trim();
    }
    if (key === 'docEditor.table.primaryColumnName') return 'Name';
    if (key === 'docEditor.table.sheetDefaultName')
      return `Sheet ${String(options?.index ?? '')}`.trim();
    if (key === 'docEditor.table.untitledFieldName') return 'Untitled field';

    return String(options?.defaultValue ?? key);
  };

  return {
    default: { t },
    t,
  };
});

vi.mock('@/utils/docsTable', async () => {
  const actual = await vi.importActual<typeof DocsTableTypes>('@/utils/docsTable');

  return {
    ...actual,
    getDefaultTableColumnName: (index: number) => (index === 0 ? 'Name' : `Column ${index + 1}`),
  };
});

vi.mock('@lobehub/ui', () => ({
  ActionIcon: vi.fn(({ onClick, title }) => (
    <button title={title} type={'button'} onClick={onClick} />
  )),
  Flexbox: vi.fn(({ children }) => <div>{children}</div>),
  Text: vi.fn(({ children }) => <span>{children}</span>),
}));

vi.mock('antd', async () => {
  const React = await import('react');

  const Input = ({
    ref,
    onBlur,
    onChange,
    onPressEnter,
    type = 'text',
    value,
    ...props
  }: any & { ref?: React.RefObject<HTMLInputElement | null> }) => (
    <input
      {...props}
      ref={ref}
      type={type}
      value={value ?? ''}
      onBlur={onBlur}
      onChange={onChange}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          onPressEnter?.(event);
        }
      }}
    />
  );

  Input.displayName = 'MockInput';

  const AutoComplete = ({ children, onBlur, onChange, onSelect, options, value }: any) => {
    const child = children
      ? React.cloneElement(children, {
          value: value ?? '',
          onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
            onBlur?.(event);
            children.props.onBlur?.(event);
          },
          onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
            onChange?.(event.target.value);
            children.props.onChange?.(event);
          },
          onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === 'Enter') {
              onSelect?.((event.currentTarget as HTMLInputElement).value);
            }

            children.props.onKeyDown?.(event);
          },
        })
      : null;

    return (
      <div data-options={JSON.stringify(options)} data-testid={'autocomplete'}>
        {child}
      </div>
    );
  };

  return {
    AutoComplete,
    Button: ({ children, onClick, type: _type, ...props }: any) => (
      <button {...props} type={'button'} onClick={onClick}>
        {children}
      </button>
    ),
    Checkbox: ({ checked, children, onChange }: any) => (
      <label>
        <input checked={checked} type={'checkbox'} onChange={onChange} />
        {children}
      </label>
    ),
    Drawer: ({ children, open, title }: any) =>
      open ? (
        <div data-testid={'drawer'}>
          <div>{title}</div>
          {children}
        </div>
      ) : null,
    Dropdown: ({ children }: any) => <div>{children}</div>,
    Input,
    Popover: ({ children }: any) => <div>{children}</div>,
    Select: ({ onChange, options = [], value }: any) => (
      <select value={value ?? ''} onChange={(event) => onChange?.(event.target.value)}>
        <option value={''} />
        {options.map((option: any) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    ),
    Tag: ({ children }: any) => <span>{children}</span>,
  };
});

vi.mock('antd-style', () => ({
  createStyles: () => () => ({
    styles: new Proxy(
      {},
      {
        get: (_, key) => String(key),
      },
    ),
  }),
  cssVar: {
    colorBgContainer: '#fff',
    colorBgElevated: '#fff',
    colorBorderSecondary: '#d9d9d9',
    colorFillQuaternary: '#f5f5f5',
    colorFillTertiary: '#fafafa',
    colorPrimary: '#1677ff',
    colorPrimaryBg: '#e6f4ff',
    colorPrimaryBgHover: '#bae0ff',
    colorPrimaryBorder: '#91caff',
    colorText: '#000',
    colorTextLightSolid: '#fff',
    colorTextQuaternary: '#999',
    colorTextSecondary: '#666',
    colorTextTertiary: '#888',
  },
  cx: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(' '),
  useTheme: () => ({
    appearance: 'light',
  }),
}));

vi.mock('react-data-grid', () => ({
  DataGrid: vi.fn(({ columns, onColumnResize, rows }: any) => {
    const indexColumn = columns.find((column: any) => column.key === '__row_index__');
    const primaryColumn = columns.find((column: any) => column.key !== '__row_index__');
    const row = rows[0];

    return (
      <div data-testid={'data-grid'}>
        <div data-testid={'row-index-cell'}>{indexColumn?.renderCell?.({ row, rowIdx: 0 })}</div>
        <div data-testid={'grid-primary-value'}>
          {primaryColumn?.renderCell?.({ row, rowIdx: 0 })}
        </div>
        <button
          data-testid={'resize-column'}
          type={'button'}
          onClick={() => primaryColumn && onColumnResize?.(primaryColumn, 320)}
        />
      </div>
    );
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (key === 'docEditor.table.columns') return `columns:${options?.count ?? 0}`;
      if (key === 'docEditor.table.defaultColumnName')
        return `Column ${options?.index ?? ''}`.trim();
      if (key === 'docEditor.table.rows') return `rows:${options?.count ?? 0}`;
      if (key === 'docEditor.table.sheetDefaultName') return `Sheet ${options?.index ?? ''}`.trim();
      if (key === 'docEditor.table.primaryField') return String(options?.name ?? '');
      if (key === 'docEditor.table.primaryColumnName') return 'Name';
      if (key === 'docEditor.table.recordDetail') return 'Record detail';
      return key;
    },
  }),
}));

vi.mock('@/store/document', () => ({
  useDocumentStore: useDocumentStoreMock,
}));

vi.mock('@/store/docs', () => ({
  pageSelectors: {
    getDocumentById: (documentId: string) => (state: typeof pageStoreState) =>
      state.documents.find((document) => document.id === documentId),
  },
  usePageStore: usePageStoreMock,
}));

vi.mock('../store', () => ({
  usePageEditorStore: usePageEditorStoreMock,
}));

const createTableState = (fieldType: TableFieldType, value: string): TableDocumentState => ({
  activeViewId: 'view-1',
  version: 2,
  views: [
    {
      fields: [
        {
          id: 'field-1',
          name: 'Name',
          type: fieldType,
          width: 200,
        },
      ],
      filters: [],
      hiddenFieldIds: [],
      id: 'view-1',
      name: 'Sheet 1',
      records: [
        {
          cells: {
            'field-1': value,
          },
          id: 'record-1',
        },
      ],
      rowHeight: 'normal',
      sorts: [],
      type: 'grid',
    },
  ],
});

const createTableStateWithFields = (
  fields: TestFieldConfig[],
  rows: string[][],
): TableDocumentState => ({
  activeViewId: 'view-1',
  version: 2,
  views: [
    {
      fields: fields.map((field, index) => ({
        id: `field-${index + 1}`,
        name: field.name,
        type: field.type ?? 'text',
        width: 200,
      })),
      filters: [],
      hiddenFieldIds: [],
      id: 'view-1',
      name: 'Sheet 1',
      records: rows.map((row, rowIndex) => ({
        cells: Object.fromEntries(
          fields.map((field, fieldIndex) => [`field-${fieldIndex + 1}`, row[fieldIndex] ?? '']),
        ),
        id: `record-${rowIndex + 1}`,
      })),
      rowHeight: 'normal',
      sorts: [],
      type: 'grid',
    },
  ],
});

describe('TableSheet', () => {
  beforeEach(() => {
    pageEditorState.documentId = 'doc-1';
    pageStoreState.documents = [];
    pageStoreState.internal_dispatchDocuments.mockReset().mockImplementation((payload: any) => {
      if (payload.type !== 'updateDocument') return;

      pageStoreState.documents = pageStoreState.documents.map((document) =>
        document.id === payload.id ? payload.document : document,
      );
    });
    documentStoreState.performSave.mockReset().mockResolvedValue(undefined);
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefers the current markdown over stale table metadata on first mount', () => {
    pageStoreState.documents = [
      {
        id: 'doc-1',
        metadata: {
          table: createTableState('text', 'stale'),
        },
      },
    ];

    render(
      <TableSheet markdownValue={'| Name |\n| --- |\n| RealBug |'} onMarkdownCommit={vi.fn()} />,
    );

    expect(screen.getByTestId('grid-primary-value')).toHaveTextContent('RealBug');
  });

  it('syncs normalized auto-generated column names back to metadata and markdown', async () => {
    const onMarkdownCommit = vi.fn();
    const buggyTable = createTableStateWithFields(
      [
        { name: 'Name' },
        { name: 'Column 2' },
        { name: 'Column 6' },
        { name: 'Column 1' },
        { name: 'Column 3' },
        { name: 'Column 4' },
        { name: 'Column 5' },
      ],
      [['RealBug', '', '', '', '', '', '']],
    );

    pageStoreState.documents = [
      {
        id: 'doc-1',
        metadata: {
          table: buggyTable,
        },
      },
    ];

    render(
      <TableSheet
        markdownValue={tableDocumentToMarkdown(buggyTable)}
        onMarkdownCommit={onMarkdownCommit}
      />,
    );

    await waitFor(() =>
      expect(
        pageStoreState.documents[0]?.metadata?.table?.views[0]?.fields.map((field) => field.name),
      ).toEqual(['Name', 'Column 2', 'Column 3', 'Column 4', 'Column 5', 'Column 6', 'Column 7']),
    );

    await waitFor(() =>
      expect(onMarkdownCommit).toHaveBeenCalledWith(
        expect.stringContaining(
          '| Name | Column 2 | Column 3 | Column 4 | Column 5 | Column 6 | Column 7 |',
        ),
      ),
    );
  });

  it('flushes pending metadata saves before switching to another document', async () => {
    vi.useFakeTimers();

    const firstDocument = {
      id: 'doc-1',
      metadata: {
        table: createTableState('text', 'Doc 1'),
      },
    };
    const secondDocument = {
      id: 'doc-2',
      metadata: {
        table: createTableState('text', 'Doc 2'),
      },
    };

    pageStoreState.documents = [firstDocument, secondDocument];

    const { rerender } = render(
      <TableSheet
        markdownValue={tableDocumentToMarkdown(firstDocument.metadata.table)}
        onMarkdownCommit={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('resize-column'));

    pageEditorState.documentId = 'doc-2';

    rerender(
      <TableSheet
        markdownValue={tableDocumentToMarkdown(secondDocument.metadata.table)}
        onMarkdownCommit={vi.fn()}
      />,
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(documentStoreState.performSave).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          table: expect.any(Object),
        }),
      }),
    );

    fireEvent.click(screen.getByTestId('resize-column'));
    await vi.advanceTimersByTimeAsync(EDITOR_MAX_WAIT + 50);

    expect(documentStoreState.performSave).toHaveBeenCalledWith(
      'doc-2',
      expect.objectContaining({
        metadata: expect.objectContaining({
          table: expect.any(Object),
        }),
      }),
    );
  });
});
