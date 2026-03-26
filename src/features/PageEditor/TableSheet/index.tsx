'use client';

import 'react-data-grid/lib/styles.css';

import { ActionIcon, Flexbox, Icon, Text } from '@lobehub/ui';
import { Input } from 'antd';
import { createStyles, cssVar, cx, useTheme } from 'antd-style';
import {
  Columns3Icon,
  GripHorizontalIcon,
  PencilLineIcon,
  Rows3Icon,
  Table2Icon,
  Trash2Icon,
} from 'lucide-react';
import {
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type CellSelectArgs, type Column, type ColumnWidths, DataGrid } from 'react-data-grid';
import { useTranslation } from 'react-i18next';

import {
  getDefaultTableColumnName,
  parseMarkdownTable,
  serializeTableMarkdown,
  type TableSheetColumn,
  type TableSheetData,
  type TableSheetRow,
} from '@/utils/pageTable';

const useStyles = createStyles(({ css, token }) => ({
  firstCell: css`
    font-weight: 600;
  `,
  grid: css`
    block-size: 100%;
    min-block-size: 540px;
  `,
  gridShell: css`
    --rdg-background-color: ${cssVar.colorBgContainer};
    --rdg-border-color: ${cssVar.colorBorderSecondary};
    --rdg-header-background-color: color-mix(
      in srgb,
      ${cssVar.colorBgContainer} 88%,
      ${cssVar.colorPrimaryBg} 12%
    );
    --rdg-row-hover-background-color: ${cssVar.colorFillQuaternary};
    --rdg-row-selected-background-color: color-mix(
      in srgb,
      ${cssVar.colorPrimaryBg} 72%,
      ${cssVar.colorBgContainer} 28%
    );
    --rdg-row-selected-hover-background-color: color-mix(
      in srgb,
      ${cssVar.colorPrimaryBgHover} 82%,
      ${cssVar.colorBgContainer} 18%
    );
    --rdg-selection-color: ${cssVar.colorPrimary};

    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;

    background:
      linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorPrimaryBg} 52%, transparent),
        transparent 72%
      ),
      ${cssVar.colorBgContainer};
    box-shadow: ${token.boxShadowSecondary};

    :global(.rdg) {
      border: none;
      background: transparent;
    }

    :global(.rdg-header-row) {
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
      backdrop-filter: blur(12px);
    }

    :global(.rdg-header-cell),
    :global(.rdg-cell) {
      padding-inline: 12px;
    }

    :global(.rdg-cell[aria-selected='true']) {
      box-shadow: inset 0 0 0 1px ${cssVar.colorPrimary};
    }
  `,
  headerCell: css`
    display: flex;
    align-items: center;

    inline-size: 100%;
    min-inline-size: 0;
    block-size: 100%;
  `,
  headerLabel: css`
    cursor: text;

    overflow: hidden;
    display: inline-flex;
    gap: 6px;
    align-items: center;

    min-inline-size: 0;
    padding-inline: 2px;
    border-radius: ${token.borderRadiusSM}px;

    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
    white-space: nowrap;

    transition: background ${token.motionDurationMid} ${token.motionEaseOut};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  metaPill: css`
    display: inline-flex;
    gap: 8px;
    align-items: center;

    padding-block: 6px;
    padding-inline: 10px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorPrimaryBorder} 75%, transparent);
    border-radius: 999px;

    color: ${cssVar.colorPrimary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 88%, transparent);
  `,
  toolbar: css`
    padding-block: 14px 12px;
    padding-inline: 14px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, ${cssVar.colorPrimaryBg} 44%, transparent),
        transparent
      ),
      transparent;
  `,
}));

const HEADER_ROW_HEIGHT = 44;
const ROW_HEIGHT = 42;

interface TableHeaderCellProps {
  column: TableSheetColumn;
  editing: boolean;
  onRename: (nextName: string) => void;
  onStartEdit: () => void;
}

const TableHeaderCell = memo<TableHeaderCellProps>(({ column, editing, onRename, onStartEdit }) => {
  const { styles } = useStyles();
  const { t } = useTranslation('file');
  const [draft, setDraft] = useState(column.name);

  useEffect(() => {
    setDraft(column.name);
  }, [column.name, editing]);

  if (editing) {
    return (
      <Input
        autoFocus
        size={'small'}
        value={draft}
        onBlur={() => onRename(draft)}
        onChange={(event) => setDraft(event.target.value)}
        onPressEnter={() => onRename(draft)}
      />
    );
  }

  return (
    <div className={styles.headerCell}>
      <div className={styles.headerLabel} onDoubleClick={onStartEdit}>
        <GripHorizontalIcon size={12} />
        <Text ellipsis style={{ minWidth: 0 }} title={t('pageEditor.table.renameColumnHint')}>
          {column.name}
        </Text>
      </div>
    </div>
  );
});

interface TableSheetProps {
  markdownValue: string;
  onMarkdownCommit: (value: string) => void;
}

const createColumnId = () => `column_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const createRowId = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const buildRow = (columns: TableSheetColumn[]) => {
  const row: TableSheetRow = { id: createRowId() };

  for (const column of columns) {
    row[column.key] = '';
  }

  return row;
};

const normalizeRows = (rows: TableSheetRow[], columns: TableSheetColumn[]) =>
  rows.map((row) => {
    const nextRow: TableSheetRow = { id: row.id || createRowId() };

    for (const column of columns) {
      nextRow[column.key] = row[column.key] ?? '';
    }

    return nextRow;
  });

const TableSheet = memo<TableSheetProps>(({ markdownValue, onMarkdownCommit }) => {
  const { t } = useTranslation('file');
  const { styles } = useStyles();
  const theme = useTheme();
  const deferredMarkdown = useDeferredValue(markdownValue);
  const lastCommittedMarkdownRef = useRef(markdownValue);
  const [sheet, setSheet] = useState(() => parseMarkdownTable(markdownValue));
  const [editingColumnKey, setEditingColumnKey] = useState<string>();
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(() => new Map());
  const [selectedCell, setSelectedCell] = useState<{ columnKey: string; rowIdx: number }>();

  useEffect(() => {
    if (deferredMarkdown === lastCommittedMarkdownRef.current) return;

    startTransition(() => {
      setSheet(parseMarkdownTable(deferredMarkdown));
    });
  }, [deferredMarkdown]);

  const commitSheet = useCallback(
    (nextSheet: TableSheetData) => {
      const nextMarkdown = serializeTableMarkdown(nextSheet);
      lastCommittedMarkdownRef.current = nextMarkdown;

      startTransition(() => {
        setSheet(nextSheet);
      });

      onMarkdownCommit(nextMarkdown);
    },
    [onMarkdownCommit],
  );

  const selectedColumnIndex =
    selectedCell?.columnKey === undefined
      ? -1
      : sheet.columns.findIndex((column) => column.key === selectedCell.columnKey);

  const selectedRowIndex =
    selectedCell?.rowIdx !== undefined && selectedCell.rowIdx >= 0 ? selectedCell.rowIdx : -1;

  const handleColumnRename = useCallback(
    (columnKey: string, nextName: string, columnIndex: number) => {
      const trimmedName = nextName.trim() || getDefaultTableColumnName(columnIndex);

      const nextColumns = sheet.columns.map((column) =>
        column.key === columnKey ? { ...column, name: trimmedName } : column,
      );

      setEditingColumnKey(undefined);
      commitSheet({ columns: nextColumns, rows: sheet.rows });
    },
    [commitSheet, sheet.columns, sheet.rows],
  );

  const handleRowsChange = (rows: TableSheetRow[]) => {
    commitSheet({
      columns: sheet.columns,
      rows: normalizeRows(rows, sheet.columns),
    });
  };

  const handleAddRow = () => {
    const insertIndex = selectedRowIndex >= 0 ? selectedRowIndex + 1 : sheet.rows.length;
    const nextRows = [...sheet.rows];
    nextRows.splice(insertIndex, 0, buildRow(sheet.columns));

    commitSheet({ columns: sheet.columns, rows: nextRows });
  };

  const handleDeleteRow = () => {
    if (selectedRowIndex < 0) return;

    const nextRows = sheet.rows.filter((_, index) => index !== selectedRowIndex);
    setSelectedCell(undefined);

    commitSheet({
      columns: sheet.columns,
      rows: nextRows.length > 0 ? nextRows : [buildRow(sheet.columns)],
    });
  };

  const handleAddColumn = () => {
    const insertIndex = selectedColumnIndex >= 0 ? selectedColumnIndex + 1 : sheet.columns.length;
    const nextColumn: TableSheetColumn = {
      key: createColumnId(),
      name: t('pageEditor.table.defaultColumnName', { index: insertIndex + 1 }),
    };
    const nextColumns = [...sheet.columns];
    nextColumns.splice(insertIndex, 0, nextColumn);
    const nextRows = sheet.rows.map((row) => ({
      ...row,
      [nextColumn.key]: '',
    }));

    commitSheet({
      columns: nextColumns,
      rows: normalizeRows(nextRows, nextColumns),
    });
  };

  const handleDeleteColumn = () => {
    if (selectedColumnIndex < 0 || sheet.columns.length === 1) return;

    const columnKey = sheet.columns[selectedColumnIndex]?.key;
    const nextColumns = sheet.columns.filter((column) => column.key !== columnKey);
    const nextRows = sheet.rows.map((row) => {
      const nextRow = { ...row };
      delete nextRow[columnKey];
      return nextRow;
    });

    setSelectedCell(undefined);
    setColumnWidths((widths) => {
      const nextWidths = new Map(widths);
      nextWidths.delete(columnKey);
      return nextWidths;
    });

    commitSheet({
      columns: nextColumns,
      rows: normalizeRows(nextRows, nextColumns),
    });
  };

  const columns = useMemo<readonly Column<TableSheetRow>[]>(
    () =>
      sheet.columns.map((column, index) => ({
        editable: true,
        frozen: index === 0,
        headerCellClass: styles.headerCell,
        key: column.key,
        minWidth: index === 0 ? 220 : 150,
        name: column.name,
        resizable: true,
        width: index === 0 ? 260 : 180,
        cellClass: index === 0 ? styles.firstCell : undefined,
        renderHeaderCell: () => (
          <TableHeaderCell
            column={column}
            editing={editingColumnKey === column.key}
            onRename={(nextName) => handleColumnRename(column.key, nextName, index)}
            onStartEdit={() => setEditingColumnKey(column.key)}
          />
        ),
      })),
    [editingColumnKey, handleColumnRename, sheet.columns, styles.firstCell, styles.headerCell],
  );

  return (
    <Flexbox
      gap={0}
      width={'100%'}
      style={{
        minHeight: 0,
      }}
    >
      <Flexbox className={styles.gridShell} width={'100%'}>
        <Flexbox
          horizontal
          align={'center'}
          className={styles.toolbar}
          gap={16}
          justify={'space-between'}
          wrap={'wrap'}
        >
          <Flexbox horizontal align={'center'} gap={10} wrap={'wrap'}>
            <div className={styles.metaPill}>
              <Icon icon={Table2Icon} />
              <Text strong>{t('pageEditor.table.title')}</Text>
            </div>
            <Text type={'secondary'}>
              {t('pageEditor.table.columns', { count: sheet.columns.length })}
            </Text>
            <Text type={'secondary'}>
              {t('pageEditor.table.rows', { count: sheet.rows.length })}
            </Text>
          </Flexbox>
          <Flexbox horizontal align={'center'} gap={4} wrap={'wrap'}>
            <ActionIcon
              icon={Rows3Icon}
              title={t('pageEditor.table.addRow')}
              onClick={handleAddRow}
            />
            <ActionIcon
              icon={Columns3Icon}
              title={t('pageEditor.table.addColumn')}
              onClick={handleAddColumn}
            />
            <ActionIcon
              disabled={selectedRowIndex < 0}
              icon={Trash2Icon}
              title={t('pageEditor.table.deleteRow')}
              onClick={handleDeleteRow}
            />
            <ActionIcon
              disabled={selectedColumnIndex < 0}
              icon={PencilLineIcon}
              title={t('pageEditor.table.renameColumnHint')}
              onClick={() =>
                selectedColumnIndex >= 0 &&
                setEditingColumnKey(sheet.columns[selectedColumnIndex]?.key)
              }
            />
            <ActionIcon
              disabled={selectedColumnIndex < 0 || sheet.columns.length === 1}
              icon={Trash2Icon}
              title={t('pageEditor.table.deleteColumn')}
              onClick={handleDeleteColumn}
            />
          </Flexbox>
        </Flexbox>
        <DataGrid
          className={cx(styles.grid, theme.appearance === 'dark' ? 'rdg-dark' : 'rdg-light')}
          columnWidths={columnWidths}
          columns={columns}
          enableVirtualization={sheet.rows.length > 30}
          headerRowHeight={HEADER_ROW_HEIGHT}
          rowHeight={ROW_HEIGHT}
          rowKeyGetter={(row) => row.id}
          rows={sheet.rows}
          onColumnWidthsChange={setColumnWidths}
          onRowsChange={handleRowsChange}
          onFill={({ columnKey, sourceRow, targetRow }) => ({
            ...targetRow,
            [columnKey]: sourceRow[columnKey] ?? '',
          })}
          onSelectedCellChange={(args: CellSelectArgs<TableSheetRow>) => {
            setSelectedCell(
              args.column
                ? {
                    columnKey: args.column.key,
                    rowIdx: args.rowIdx,
                  }
                : undefined,
            );
          }}
        />
      </Flexbox>
    </Flexbox>
  );
});

TableSheet.displayName = 'TableSheet';

export default TableSheet;
