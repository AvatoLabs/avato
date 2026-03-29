'use client';

import 'react-data-grid/lib/styles.css';

import { EDITOR_DEBOUNCE_TIME, EDITOR_MAX_WAIT } from '@lobechat/const';
import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import {
  AutoComplete,
  Button,
  Checkbox,
  Drawer,
  Dropdown,
  Input,
  type MenuProps,
  Popover,
  Select,
  Tag,
} from 'antd';
import { createStyles, cssVar, cx, useTheme } from 'antd-style';
import { debounce } from 'es-toolkit/compat';
import isEqual from 'fast-deep-equal';
import {
  ArrowDownWideNarrowIcon,
  Columns3Icon,
  EyeOffIcon,
  FilterIcon,
  LayoutGridIcon,
  MoreHorizontalIcon,
  PencilLineIcon,
  PlusIcon,
  Rows3Icon,
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
import type {
  CellMouseArgs,
  CellSelectArgs,
  Column,
  RenderCellProps,
  RenderEditCellProps,
} from 'react-data-grid';
import { DataGrid } from 'react-data-grid';
import { useTranslation } from 'react-i18next';

import { pageSelectors, usePageStore } from '@/store/docs';
import { useDocumentStore } from '@/store/document';
import { getDefaultTableColumnName } from '@/utils/docsTable';
import {
  appendBlankTableView,
  createTableField,
  createTableRecord,
  duplicateTableView,
  getPrimaryField,
  getRecordTitle,
  normalizeTableCellValue,
  normalizeTableDocument,
  projectTableView,
  removeTableView,
  renameActiveTableView,
  setActiveTableView,
  type TableCellValue,
  type TableDocumentState,
  tableDocumentToMarkdown,
  type TableField,
  type TableFieldType,
  type TableRecord,
  type TableRowHeight,
  type TableSortDirection,
  type TableViewFilter,
  updateTableFieldWidths,
} from '@/utils/tableDocument';

import { usePageEditorStore } from '../store';

const ROW_INDEX_COLUMN_KEY = '__row_index__';
const ROW_INDEX_COLUMN_WIDTH = 56;
const GRID_HEADER_HEIGHT = 42;
const PRIMARY_COLUMN_WIDTH = 260;
const SECONDARY_COLUMN_WIDTH = 180;
const GRID_BORDER_WIDTH = 2;
const ROW_HEIGHT_MAP: Record<TableRowHeight, number> = {
  comfortable: 48,
  compact: 34,
  normal: 40,
};

const useStyles = createStyles(({ css, token }) => ({
  cellValue: css`
    overflow: hidden;
    display: inline-flex;
    align-items: center;

    inline-size: 100%;
    min-inline-size: 0;
    block-size: 100%;

    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  drawerField: css`
    gap: 6px;
    padding-block: 10px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  drawerFieldMeta: css`
    display: inline-flex;
    gap: 8px;
    align-items: center;
  `,
  emptyValue: css`
    color: ${cssVar.colorTextQuaternary};
  `,
  fieldMenuButton: css`
    color: ${cssVar.colorTextSecondary};

    &:hover,
    &:focus-visible {
      color: ${cssVar.colorPrimary};
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 56%, transparent);
    }
  `,
  fieldTypeTag: css`
    margin-inline: 0;
    border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 24%, transparent);
    border-radius: 999px;

    font-size: 11px;
    color: ${cssVar.colorTextSecondary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 24%, ${cssVar.colorFillQuaternary} 76%);
  `,
  filterPanel: css`
    overflow-y: auto;
    inline-size: 340px;
    max-block-size: min(60vh, 420px);
  `,
  footer: css`
    padding-block: 8px;
    padding-inline: 8px 12px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorBgContainer};
  `,
  footerButton: css`
    padding-inline: 10px;
    border-radius: ${token.borderRadius}px;
    color: ${cssVar.colorTextSecondary};

    &:hover,
    &:focus-visible {
      color: ${cssVar.colorPrimary};
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 52%, ${cssVar.colorFillTertiary} 48%);
    }
  `,
  grid: css`
    inline-size: 100%;
  `,
  gridShell: css`
    --rdg-background-color: ${cssVar.colorBgContainer};
    --rdg-border-color: ${cssVar.colorBorderSecondary};
    --rdg-header-background-color: ${cssVar.colorBgContainer};
    --rdg-row-hover-background-color: ${cssVar.colorFillQuaternary};
    --rdg-row-selected-background-color: color-mix(
      in srgb,
      ${cssVar.colorPrimaryBg} 34%,
      ${cssVar.colorBgContainer} 66%
    );
    --rdg-row-selected-hover-background-color: color-mix(
      in srgb,
      ${cssVar.colorPrimaryBgHover} 42%,
      ${cssVar.colorBgContainer} 58%
    );
    --rdg-selection-color: ${cssVar.colorPrimary};

    overflow: visible;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${cssVar.colorBgContainer};

    :global(.rdg) {
      border: none;
      background: transparent;
    }

    :global(.rdg-header-row) {
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    }

    :global(.rdg-header-cell),
    :global(.rdg-cell) {
      padding-inline: 12px;
      font-size: 13px;
    }

    :global(.rdg-cell[aria-selected='true']) {
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 24%, ${cssVar.colorBgContainer} 76%);
      box-shadow: inset 0 0 0 1px ${cssVar.colorPrimary};
    }

    html[data-theme='dark'] & :global(.rdg-row[aria-selected='true'] .rdg-cell),
    html[data-theme='dark'] & :global(.rdg-cell[aria-selected='true']) {
      color: ${cssVar.colorTextLightSolid};
    }

    html[data-theme='dark'] & :global(.rdg-row[aria-selected='true'] .rdg-cell a),
    html[data-theme='dark'] & :global(.rdg-cell[aria-selected='true'] a) {
      color: ${cssVar.colorTextLightSolid};
    }
  `,
  headerCell: css`
    display: flex;
    gap: 8px;
    align-items: center;

    inline-size: 100%;
    min-inline-size: 0;
    block-size: 100%;
  `,
  headerEditingInput: css`
    inline-size: 100%;
  `,
  headerMeta: css`
    overflow: hidden;
    display: inline-flex;
    align-items: center;

    max-inline-size: 72px;

    font-size: 11px;
    color: ${cssVar.colorTextTertiary};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  headerName: css`
    overflow: hidden;

    min-inline-size: 0;

    font-weight: 600;
    color: ${cssVar.colorText};
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  iconButton: css`
    color: ${cssVar.colorTextSecondary};

    &:hover,
    &:focus-visible {
      color: ${cssVar.colorPrimary};
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 52%, ${cssVar.colorFillTertiary} 48%);
    }
  `,
  indexCellButton: css`
    justify-content: flex-start;
    inline-size: 100%;
    padding-inline: 6px;
    color: ${cssVar.colorTextSecondary};
  `,
  meta: css`
    font-variant-numeric: tabular-nums;
  `,
  metaDivider: css`
    inline-size: 4px;
    block-size: 4px;
    border-radius: 999px;
    background: ${cssVar.colorTextQuaternary};
  `,
  toolbar: css`
    scrollbar-width: thin;

    overflow: auto hidden;
    gap: 12px;

    padding-block: 10px;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};
  `,
  toolbarButton: css`
    padding-inline: 10px;
    border-color: ${cssVar.colorBorderSecondary};
    border-radius: ${token.borderRadius}px;

    color: ${cssVar.colorTextSecondary};

    background: transparent;

    &:hover,
    &:focus-visible {
      border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 60%, transparent);
      color: ${cssVar.colorPrimary};
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 24%, ${cssVar.colorBgElevated} 76%);
    }
  `,
  viewBar: css`
    scrollbar-width: thin;

    overflow: auto hidden;
    gap: 8px;

    padding-block: 10px 0;
    padding-inline: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorBgContainer};
  `,
  viewButton: css`
    min-block-size: 34px;
    padding-inline: 12px;
    border: 1px solid transparent;
    border-radius: ${token.borderRadius}px ${token.borderRadius}px 0 0;

    color: ${cssVar.colorTextSecondary};

    &:hover,
    &:focus-visible {
      color: ${cssVar.colorPrimary};
      background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 18%, ${cssVar.colorFillTertiary} 82%);
    }
  `,
  viewButtonActive: css`
    border-color: color-mix(in srgb, ${cssVar.colorPrimaryBorder} 52%, transparent);
    border-block-end-color: transparent;

    color: ${cssVar.colorPrimary};

    background: color-mix(in srgb, ${cssVar.colorPrimaryBg} 24%, ${cssVar.colorBgContainer} 76%);
    box-shadow: inset 0 -2px 0 ${cssVar.colorPrimary};
  `,
  viewInput: css`
    inline-size: 160px;
  `,
  viewMeta: css`
    gap: 10px;
    min-block-size: 32px;
  `,
}));

interface TableCellEditorProps {
  field: TableField;
  props: RenderEditCellProps<TableRecord>;
  selectOptions: string[];
}

interface TableMetadataSavePayload {
  documentId: string;
  metadata: Record<string, any>;
}

interface TranslateFn {
  (key: string, options?: Record<string, unknown>): string;
}

const TableCellEditor = memo<TableCellEditorProps>(({ field, props, selectOptions }) => {
  const rawValue = props.row.cells[field.id];
  const value =
    typeof rawValue === 'boolean' ? (rawValue ? 'true' : 'false') : String(rawValue ?? '');
  const [draftValue, setDraftValue] = useState(value);
  const buildNextRow = (nextValue: string) => ({
    ...props.row,
    cells: {
      ...props.row.cells,
      [field.id]: normalizeFieldValue(field.type, nextValue),
    },
  });

  useEffect(() => {
    setDraftValue(value);
  }, [value]);

  if (field.type === 'select') {
    const commitDraftValue = (nextValue: string) => {
      props.onRowChange(buildNextRow(nextValue), true);
      props.onClose(true, true);
    };

    return (
      <AutoComplete
        options={selectOptions.map((option) => ({ label: option, value: option }))}
        style={{ width: '100%' }}
        value={draftValue}
        onChange={(nextValue) => setDraftValue(nextValue)}
        onSelect={(nextValue) => {
          setDraftValue(nextValue);
          commitDraftValue(nextValue);
        }}
      >
        <Input
          autoFocus
          size={'small'}
          value={draftValue}
          onBlur={() => commitDraftValue(draftValue)}
          onChange={(event) => setDraftValue(event.target.value)}
          onPressEnter={() => commitDraftValue(draftValue)}
        />
      </AutoComplete>
    );
  }

  return (
    <Input
      autoFocus
      size={'small'}
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      value={value}
      onBlur={() => props.onClose(true, false)}
      onChange={(event) => props.onRowChange(buildNextRow(event.target.value))}
      onPressEnter={() => props.onClose(true, true)}
    />
  );
});

interface TableSheetProps {
  markdownValue: string;
  onMarkdownCommit: (value: string) => void;
}

const TableSheet = memo<TableSheetProps>(({ markdownValue, onMarkdownCommit }) => {
  const { t } = useTranslation('file');
  const translate = t as unknown as TranslateFn;
  const { styles } = useStyles();
  const theme = useTheme();
  const deferredMarkdown = useDeferredValue(markdownValue);
  const documentId = usePageEditorStore((s) => s.documentId);
  const document = usePageStore((s) =>
    documentId ? pageSelectors.getDocumentById(documentId)(s) : undefined,
  );
  const tableMetadata = document?.metadata?.table;
  const serializedTableMetadata = useMemo(
    () => JSON.stringify(tableMetadata ?? null),
    [tableMetadata],
  );
  const shouldPreferMarkdownContent = useMemo(
    () => shouldPreferMarkdownTableContent(markdownValue, tableMetadata),
    [markdownValue, serializedTableMetadata, tableMetadata],
  );
  const shouldPreferDeferredMarkdownContent = useMemo(
    () => shouldPreferMarkdownTableContent(deferredMarkdown, tableMetadata),
    [deferredMarkdown, serializedTableMetadata, tableMetadata],
  );

  const [drawerRecordId, setDrawerRecordId] = useState<string>();
  const [editingFieldId, setEditingFieldId] = useState<string>();
  const [editingFieldName, setEditingFieldName] = useState('');
  const [editingViewId, setEditingViewId] = useState<string>();
  const [editingViewName, setEditingViewName] = useState('');
  const [selectedFieldId, setSelectedFieldId] = useState<string>();
  const [selectedRecordId, setSelectedRecordId] = useState<string>();
  const [table, setTable] = useState(() =>
    normalizeTableDocument(markdownValue, tableMetadata, {
      preferMarkdownContent: shouldPreferMarkdownContent,
    }),
  );

  const lastCommittedTableRef = useRef(table);
  const normalizedMetadataSyncKeyRef = useRef<string>();
  const lastDocumentIdRef = useRef(documentId);
  const metadataSaveRef = useRef<ReturnType<typeof debounce> | undefined>(undefined);

  if (!metadataSaveRef.current) {
    metadataSaveRef.current = debounce(
      async ({ documentId, metadata }: TableMetadataSavePayload) => {
        try {
          await useDocumentStore.getState().performSave(documentId, { metadata });
        } catch (error) {
          console.error('[TableSheet] Failed to save table metadata:', error);
        }
      },
      EDITOR_DEBOUNCE_TIME,
      { leading: false, maxWait: EDITOR_MAX_WAIT, trailing: true },
    );
  }

  useEffect(() => {
    const previousDocumentId = lastDocumentIdRef.current;

    if (previousDocumentId && previousDocumentId !== documentId) {
      metadataSaveRef.current?.flush();
      setDrawerRecordId(undefined);
      setEditingFieldId(undefined);
      setEditingFieldName('');
      setEditingViewId(undefined);
      setEditingViewName('');
      setSelectedFieldId(undefined);
      setSelectedRecordId(undefined);
    }

    lastDocumentIdRef.current = documentId;
  }, [documentId]);

  useEffect(() => {
    return () => {
      metadataSaveRef.current?.flush();
    };
  }, []);

  useEffect(() => {
    const nextTable = normalizeTableDocument(deferredMarkdown, tableMetadata, {
      preferMarkdownContent: shouldPreferDeferredMarkdownContent,
    });

    if (isEqual(nextTable, lastCommittedTableRef.current)) return;

    lastCommittedTableRef.current = nextTable;
    startTransition(() => {
      setTable(nextTable);
    });
  }, [
    deferredMarkdown,
    document?.id,
    serializedTableMetadata,
    shouldPreferDeferredMarkdownContent,
    tableMetadata,
  ]);

  const projection = useMemo(() => projectTableView(table), [table]);
  const activeView = projection.view;
  const activeFields = activeView.fields;
  const activeRecords = activeView.records;
  const rowHeight = ROW_HEIGHT_MAP[activeView.rowHeight] || ROW_HEIGHT_MAP.normal;
  const getRenderedColumnWidth = useCallback(
    (field: TableField, index: number) =>
      field.width || (index === 0 ? PRIMARY_COLUMN_WIDTH : SECONDARY_COLUMN_WIDTH),
    [],
  );
  const gridHeight = useMemo(
    () => GRID_HEADER_HEIGHT + projection.records.length * rowHeight + GRID_BORDER_WIDTH,
    [projection.records.length, rowHeight],
  );
  const gridSchemaKey = useMemo(
    () =>
      [
        activeView.id,
        activeFields.map((field) => `${field.id}:${field.type}:${field.width ?? ''}`).join('|'),
        activeView.hiddenFieldIds.join('|'),
      ].join('::'),
    [activeFields, activeView.hiddenFieldIds, activeView.id],
  );
  const activeRecord = useMemo(
    () => activeRecords.find((record) => record.id === drawerRecordId),
    [activeRecords, drawerRecordId],
  );
  const primaryField = useMemo(() => getPrimaryField(activeView), [activeView]);

  const selectOptionsByField = useMemo(() => {
    return Object.fromEntries(
      activeFields.map((field) => [
        field.id,
        Array.from(
          new Set(
            activeRecords
              .map((record) => record.cells[field.id])
              .filter((value) => typeof value === 'string' && value.trim())
              .map((value) => String(value)),
          ),
        ),
      ]),
    ) as Record<string, string[]>;
  }, [activeFields, activeRecords]);

  const fieldOptions = useMemo(
    () =>
      activeFields.map((field) => ({
        label: field.name,
        value: field.id,
      })),
    [activeFields],
  );

  const getNextFieldName = useCallback(() => {
    for (let index = 1; index <= activeFields.length + 1; index += 1) {
      const name = getDefaultTableColumnName(index);
      if (!activeFields.some((field) => field.name === name)) {
        return name;
      }
    }

    return getDefaultTableColumnName(activeFields.length + 1);
  }, [activeFields]);

  const getNextSheetName = useCallback(() => {
    for (let index = 1; index <= table.views.length + 1; index += 1) {
      const name = translate('docEditor.table.sheetDefaultName', { index });
      if (!table.views.some((view) => view.name === name)) {
        return name;
      }
    }

    return translate('docEditor.table.sheetDefaultName', { index: table.views.length + 1 });
  }, [table.views, translate]);

  const commitTable = useCallback(
    (nextTable: TableDocumentState) => {
      const nextMarkdown = tableDocumentToMarkdown(nextTable);

      // Always update local state to ensure UI responsiveness
      lastCommittedTableRef.current = nextTable;
      startTransition(() => {
        setTable(nextTable);
      });

      // Sync markdown content to parent
      if (nextMarkdown !== markdownValue) {
        onMarkdownCommit(nextMarkdown);
      }

      // Skip persistence if documentId is not available
      if (!documentId) return;

      const nextDocument = usePageStore
        .getState()
        .documents?.find((item) => item.id === documentId);

      const nextMetadata = {
        ...nextDocument?.metadata,
        table: nextTable,
      };

      if (nextDocument) {
        usePageStore.getState().internal_dispatchDocuments({
          document: {
            ...nextDocument,
            content: nextMarkdown,
            metadata: nextMetadata,
            totalCharCount: nextMarkdown.length,
            totalLineCount: nextMarkdown.split('\n').length,
            updatedAt: new Date(),
          },
          id: documentId,
          type: 'updateDocument',
        });
      }

      metadataSaveRef.current?.({ documentId, metadata: nextMetadata });
    },
    [documentId, markdownValue, onMarkdownCommit],
  );

  useEffect(() => {
    if (!documentId || !document || isEqual(tableMetadata, table)) return;

    const syncKey = `${documentId}::${serializedTableMetadata}`;
    if (normalizedMetadataSyncKeyRef.current === syncKey) return;

    normalizedMetadataSyncKeyRef.current = syncKey;
    commitTable(table);
  }, [commitTable, document, documentId, serializedTableMetadata, table, tableMetadata]);

  const updateActiveView = useCallback(
    (updater: (view: typeof activeView) => typeof activeView) => {
      commitTable({
        ...table,
        views: table.views.map((view) => (view.id === activeView.id ? updater(view) : view)),
      });
    },
    [activeView, commitTable, table],
  );

  const updateField = useCallback(
    (fieldId: string, updater: (field: TableField) => TableField) => {
      updateActiveView((view) => ({
        ...view,
        fields: view.fields.map((field) => (field.id === fieldId ? updater(field) : field)),
      }));
    },
    [updateActiveView],
  );

  const updateRecordValue = useCallback(
    (recordId: string, field: TableField, nextValue: string | boolean) => {
      updateActiveView((view) => ({
        ...view,
        records: view.records.map((record) =>
          record.id === recordId
            ? {
                ...record,
                cells: {
                  ...record.cells,
                  [field.id]:
                    typeof nextValue === 'boolean'
                      ? nextValue
                      : normalizeFieldValue(field.type, nextValue),
                },
              }
            : record,
        ),
      }));
    },
    [updateActiveView],
  );

  const startFieldRename = useCallback(
    (fieldId: string) => {
      const field = activeFields.find((item) => item.id === fieldId);
      if (!field) return;

      setEditingFieldId(fieldId);
      setEditingFieldName(field.name);
    },
    [activeFields],
  );

  const finishFieldRename = useCallback(
    (fieldId: string, nextName: string) => {
      updateField(fieldId, (field) => ({
        ...field,
        name: nextName.trim() || field.name,
      }));
      setEditingFieldId(undefined);
      setEditingFieldName('');
    },
    [updateField],
  );

  const startViewRename = useCallback(
    (viewId: string) => {
      const view = table.views.find((item) => item.id === viewId);
      if (!view) return;

      setEditingViewId(viewId);
      setEditingViewName(view.name);
    },
    [table.views],
  );

  const finishViewRename = useCallback(
    (viewId: string, nextName: string) => {
      commitTable(renameActiveTableView(setActiveTableView(table, viewId), nextName));
      setEditingViewId(undefined);
      setEditingViewName('');
    },
    [commitTable, table],
  );

  const handleRowsChange = useCallback(
    (nextRows: TableRecord[]) => {
      const changedRows = new Map(nextRows.map((row) => [row.id, row]));

      updateActiveView((view) => ({
        ...view,
        records: view.records.map((row) => changedRows.get(row.id) || row),
      }));
    },
    [updateActiveView],
  );

  const handleAddRecord = useCallback(() => {
    const nextRecord = createTableRecord(activeFields);
    const selectedRecordIndex = activeRecords.findIndex((record) => record.id === selectedRecordId);
    const nextRecords = [...activeRecords];

    if (selectedRecordIndex >= 0) {
      nextRecords.splice(selectedRecordIndex + 1, 0, nextRecord);
    } else {
      nextRecords.push(nextRecord);
    }

    setSelectedRecordId(nextRecord.id);
    updateActiveView((view) => ({
      ...view,
      records: nextRecords,
    }));
  }, [activeFields, activeRecords, selectedRecordId, updateActiveView]);

  const handleDeleteRecord = useCallback(() => {
    if (!selectedRecordId || activeRecords.length === 1) return;

    setDrawerRecordId((current) => (current === selectedRecordId ? undefined : current));
    setSelectedRecordId(undefined);

    updateActiveView((view) => ({
      ...view,
      records: view.records.filter((record) => record.id !== selectedRecordId),
    }));
  }, [activeRecords.length, selectedRecordId, updateActiveView]);

  const handleAddField = useCallback(() => {
    const insertIndex = selectedFieldId
      ? activeFields.findIndex((field) => field.id === selectedFieldId) + 1
      : activeFields.length;
    const nextField = createTableField(getNextFieldName());
    const nextFields = [...activeFields];

    nextFields.splice(insertIndex, 0, nextField);

    updateActiveView((view) => ({
      ...view,
      fields: nextFields,
      records: view.records.map((record) => ({
        ...record,
        cells: {
          ...record.cells,
          [nextField.id]: '',
        },
      })),
    }));
    startFieldRename(nextField.id);
  }, [activeFields, getNextFieldName, selectedFieldId, startFieldRename, updateActiveView]);

  const handleDeleteField = useCallback(
    (fieldId: string) => {
      if (activeFields.length === 1) return;

      const nextFields = activeFields.filter((field) => field.id !== fieldId);
      setSelectedFieldId((current) => (current === fieldId ? undefined : current));
      setEditingFieldId((current) => (current === fieldId ? undefined : current));
      setEditingFieldName((current) => (editingFieldId === fieldId ? '' : current));

      updateActiveView((view) => ({
        ...view,
        fields: nextFields,
        records: view.records.map((record) => {
          const nextCells = { ...record.cells };
          delete nextCells[fieldId];
          return { ...record, cells: nextCells };
        }),
        filters: view.filters.filter((filter) => filter.fieldId !== fieldId),
        hiddenFieldIds: view.hiddenFieldIds.filter((id) => id !== fieldId),
        sorts: view.sorts.filter((sort) => sort.fieldId !== fieldId),
        ...(view.groupByFieldId === fieldId ? { groupByFieldId: undefined } : {}),
      }));
    },
    [activeFields, editingFieldId, updateActiveView],
  );

  const handleAddFilter = useCallback(() => {
    const defaultField = activeFields[0];
    if (!defaultField) return;

    updateActiveView((view) => ({
      ...view,
      filters: [
        ...view.filters,
        {
          fieldId: defaultField.id,
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          operator:
            defaultField.type === 'number' || defaultField.type === 'date' ? 'equals' : 'contains',
          value: '',
        },
      ],
    }));
  }, [activeFields, updateActiveView]);

  const handleAddSort = useCallback(() => {
    const defaultField = activeFields[0];
    if (!defaultField) return;

    updateActiveView((view) => ({
      ...view,
      sorts: [
        ...view.sorts,
        {
          direction: 'asc',
          fieldId: defaultField.id,
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        },
      ],
    }));
  }, [activeFields, updateActiveView]);

  const columns = useMemo<readonly Column<TableRecord>[]>(
    () => [
      {
        editable: false,
        frozen: true,
        key: ROW_INDEX_COLUMN_KEY,
        maxWidth: 56,
        minWidth: 56,
        name: '',
        renderCell: ({ row, rowIdx }) => (
          <Button
            className={styles.indexCellButton}
            size={'small'}
            type={'text'}
            onClick={() => setDrawerRecordId(row.id)}
          >
            {rowIdx + 1}
          </Button>
        ),
        renderHeaderCell: () => <LayoutGridIcon size={14} />,
        resizable: false,
        width: ROW_INDEX_COLUMN_WIDTH,
      },
      ...projection.fields.map((field, index) => ({
        editable: field.type !== 'checkbox',
        frozen: index === 0,
        key: field.id,
        minWidth: index === 0 ? 220 : 160,
        name: field.name,
        renderCell: ({ row }: RenderCellProps<TableRecord>) =>
          renderFieldValue(field, row.cells[field.id], translate, styles),
        renderEditCell:
          field.type === 'checkbox'
            ? undefined
            : (props: RenderEditCellProps<TableRecord>) => (
                <TableCellEditor
                  field={field}
                  props={props}
                  selectOptions={selectOptionsByField[field.id] || []}
                />
              ),
        renderHeaderCell: () => {
          const fieldTypeItems = getFieldTypeItems(translate, (fieldType) => {
            updateActiveView((view) => ({
              ...view,
              fields: view.fields.map((item) =>
                item.id === field.id ? { ...item, type: fieldType } : item,
              ),
              records: view.records.map((record) => ({
                ...record,
                cells: {
                  ...record.cells,
                  [field.id]: normalizeFieldValue(fieldType, record.cells[field.id]),
                },
              })),
            }));
          });

          return editingFieldId === field.id ? (
            <Input
              autoFocus
              className={styles.headerEditingInput}
              size={'small'}
              value={editingFieldName}
              onBlur={(event) => finishFieldRename(field.id, event.target.value)}
              onChange={(event) => setEditingFieldName(event.target.value)}
              onPressEnter={() => finishFieldRename(field.id, editingFieldName)}
            />
          ) : (
            <div className={styles.headerCell}>
              <Flexbox
                horizontal
                align={'center'}
                gap={6}
                style={{ flex: 1, minWidth: 0 }}
                onDoubleClick={() => startFieldRename(field.id)}
              >
                <Text className={styles.headerName}>{field.name}</Text>
                <Text className={styles.headerMeta}>
                  {translate(`docEditor.table.fieldTypes.${field.type}`)}
                </Text>
              </Flexbox>
              <Dropdown
                trigger={['click']}
                menu={{
                  items: [
                    {
                      icon: <PencilLineIcon size={14} />,
                      key: 'rename',
                      label: translate('docEditor.table.renameColumnHint'),
                      onClick: () => startFieldRename(field.id),
                    },
                    {
                      children: fieldTypeItems,
                      key: 'type',
                      label: translate('docEditor.table.changeFieldType'),
                    },
                    {
                      icon: <EyeOffIcon size={14} />,
                      key: 'hide',
                      label: translate('docEditor.table.hideField'),
                      onClick: () =>
                        updateActiveView((view) => ({
                          ...view,
                          hiddenFieldIds: Array.from(new Set([...view.hiddenFieldIds, field.id])),
                        })),
                    },
                    {
                      danger: true,
                      icon: <Trash2Icon size={14} />,
                      key: 'delete',
                      label: translate('docEditor.table.deleteColumn'),
                      onClick: () => handleDeleteField(field.id),
                    },
                  ],
                }}
              >
                <ActionIcon
                  className={styles.fieldMenuButton}
                  icon={MoreHorizontalIcon}
                  size={16}
                />
              </Dropdown>
            </div>
          );
        },
        resizable: true,
        width: getRenderedColumnWidth(field, index),
      })),
    ],
    [
      editingFieldId,
      editingFieldName,
      finishFieldRename,
      handleDeleteField,
      projection.fields,
      selectOptionsByField,
      startFieldRename,
      styles,
      translate,
      getRenderedColumnWidth,
      updateActiveView,
    ],
  );

  const filterPanel = (
    <Flexbox className={styles.filterPanel} gap={10}>
      {activeView.filters.map((filter) => {
        const field = activeFields.find((item) => item.id === filter.fieldId) || activeFields[0];
        const operatorOptions = getFilterOperatorOptions(field?.type || 'text', translate);

        return (
          <Flexbox gap={8} key={filter.id}>
            <Flexbox horizontal gap={8}>
              <Select
                options={fieldOptions}
                size={'small'}
                style={{ flex: 1 }}
                value={filter.fieldId}
                onChange={(value) =>
                  updateActiveView((view) => ({
                    ...view,
                    filters: view.filters.map((item) =>
                      item.id === filter.id ? { ...item, fieldId: value } : item,
                    ),
                  }))
                }
              />
              <Select
                options={operatorOptions}
                size={'small'}
                style={{ width: 140 }}
                value={filter.operator}
                onChange={(value) =>
                  updateActiveView((view) => ({
                    ...view,
                    filters: view.filters.map((item) =>
                      item.id === filter.id ? { ...item, operator: value } : item,
                    ),
                  }))
                }
              />
            </Flexbox>
            {!['isEmpty', 'isNotEmpty'].includes(filter.operator) &&
              renderFilterValueInput(field, filter, translate, (value) =>
                updateActiveView((view) => ({
                  ...view,
                  filters: view.filters.map((item) =>
                    item.id === filter.id ? { ...item, value } : item,
                  ),
                })),
              )}
            <Button
              danger
              size={'small'}
              type={'text'}
              onClick={() =>
                updateActiveView((view) => ({
                  ...view,
                  filters: view.filters.filter((item) => item.id !== filter.id),
                }))
              }
            >
              {translate('docEditor.table.removeRule')}
            </Button>
          </Flexbox>
        );
      })}
      <Button icon={<PlusIcon size={14} />} size={'small'} type={'text'} onClick={handleAddFilter}>
        {translate('docEditor.table.addFilter')}
      </Button>
    </Flexbox>
  );

  const sortPanel = (
    <Flexbox className={styles.filterPanel} gap={10}>
      {activeView.sorts.map((sort) => (
        <Flexbox horizontal gap={8} key={sort.id}>
          <Select
            options={fieldOptions}
            size={'small'}
            style={{ flex: 1 }}
            value={sort.fieldId}
            onChange={(value) =>
              updateActiveView((view) => ({
                ...view,
                sorts: view.sorts.map((item) =>
                  item.id === sort.id ? { ...item, fieldId: value } : item,
                ),
              }))
            }
          />
          <Select
            options={getSortDirectionOptions(translate)}
            size={'small'}
            style={{ width: 120 }}
            value={sort.direction}
            onChange={(value: TableSortDirection) =>
              updateActiveView((view) => ({
                ...view,
                sorts: view.sorts.map((item) =>
                  item.id === sort.id ? { ...item, direction: value } : item,
                ),
              }))
            }
          />
          <Button
            danger
            size={'small'}
            type={'text'}
            onClick={() =>
              updateActiveView((view) => ({
                ...view,
                sorts: view.sorts.filter((item) => item.id !== sort.id),
              }))
            }
          >
            {translate('docEditor.table.removeRule')}
          </Button>
        </Flexbox>
      ))}
      <Button icon={<PlusIcon size={14} />} size={'small'} type={'text'} onClick={handleAddSort}>
        {translate('docEditor.table.addSort')}
      </Button>
    </Flexbox>
  );

  const fieldPanel = (
    <Flexbox className={styles.filterPanel} gap={8}>
      {activeFields.map((field) => {
        const hidden = activeView.hiddenFieldIds.includes(field.id);

        return (
          <Flexbox horizontal align={'center'} gap={8} justify={'space-between'} key={field.id}>
            <Flexbox horizontal align={'center'} gap={8}>
              <Checkbox
                checked={!hidden}
                onChange={(event) =>
                  updateActiveView((view) => ({
                    ...view,
                    hiddenFieldIds: event.target.checked
                      ? view.hiddenFieldIds.filter((id) => id !== field.id)
                      : Array.from(new Set([...view.hiddenFieldIds, field.id])),
                  }))
                }
              />
              <Text>{field.name}</Text>
            </Flexbox>
            <Tag className={styles.fieldTypeTag}>
              {translate(`docEditor.table.fieldTypes.${field.type}`)}
            </Tag>
          </Flexbox>
        );
      })}
      <Button icon={<PlusIcon size={14} />} size={'small'} type={'text'} onClick={handleAddField}>
        {translate('docEditor.table.addColumn')}
      </Button>
    </Flexbox>
  );

  const viewMenuItems = [
    {
      icon: <PencilLineIcon size={14} />,
      key: 'rename',
      label: translate('docEditor.table.renameSheet'),
      onClick: () => startViewRename(activeView.id),
    },
    {
      icon: <PlusIcon size={14} />,
      key: 'duplicate',
      label: translate('docEditor.table.duplicateSheet'),
      onClick: () =>
        commitTable(
          duplicateTableView(
            table,
            translate('docEditor.table.sheetDuplicateName', { name: activeView.name }),
          ),
        ),
    },
    {
      danger: table.views.length > 1,
      disabled: table.views.length === 1,
      icon: <Trash2Icon size={14} />,
      key: 'delete',
      label: translate('docEditor.table.deleteSheet'),
      onClick: () => commitTable(removeTableView(table, activeView.id)),
    },
  ] satisfies MenuProps['items'];

  return (
    <>
      <Flexbox gap={0} style={{ minHeight: 0 }} width={'100%'}>
        <Flexbox style={{ maxWidth: '100%', width: '100%' }}>
          <Flexbox className={styles.gridShell}>
            <Flexbox
              horizontal
              align={'center'}
              className={styles.viewBar}
              justify={'space-between'}
              style={{ gap: 12 }}
            >
              <Flexbox horizontal align={'center'} gap={8} style={{ flex: 'none' }}>
                {table.views.map((view) =>
                  editingViewId === view.id ? (
                    <Input
                      autoFocus
                      className={styles.viewInput}
                      key={view.id}
                      size={'small'}
                      value={editingViewName}
                      onBlur={(event) => finishViewRename(view.id, event.target.value)}
                      onChange={(event) => setEditingViewName(event.target.value)}
                      onPressEnter={() => finishViewRename(view.id, editingViewName)}
                    />
                  ) : (
                    <Button
                      icon={<LayoutGridIcon size={14} />}
                      key={view.id}
                      size={'small'}
                      type={'text'}
                      className={cx(
                        styles.viewButton,
                        view.id === activeView.id && styles.viewButtonActive,
                      )}
                      onClick={() => commitTable(setActiveTableView(table, view.id))}
                    >
                      {view.name}
                    </Button>
                  ),
                )}
                <ActionIcon
                  className={styles.iconButton}
                  icon={PlusIcon}
                  size={16}
                  title={translate('docEditor.table.newSheet')}
                  onClick={() => commitTable(appendBlankTableView(table, getNextSheetName()))}
                />
              </Flexbox>
              <Dropdown menu={{ items: viewMenuItems }} trigger={['click']}>
                <ActionIcon className={styles.iconButton} icon={MoreHorizontalIcon} size={16} />
              </Dropdown>
            </Flexbox>

            <Flexbox
              horizontal
              align={'center'}
              className={styles.toolbar}
              justify={'space-between'}
              style={{ gap: 12 }}
            >
              <Flexbox
                horizontal
                align={'center'}
                className={styles.viewMeta}
                style={{ flex: 'none' }}
              >
                <Text className={styles.meta} type={'secondary'}>
                  {translate('docEditor.table.columns', { count: projection.fields.length })}
                </Text>
                <div className={styles.metaDivider} />
                <Text className={styles.meta} type={'secondary'}>
                  {translate('docEditor.table.rows', { count: projection.records.length })}
                </Text>
              </Flexbox>

              <Flexbox horizontal align={'center'} gap={8} style={{ flex: 'none' }}>
                <Popover
                  nativeButton
                  content={filterPanel}
                  placement={'bottomRight'}
                  trigger={'click'}
                >
                  <Button
                    className={styles.toolbarButton}
                    icon={<FilterIcon size={14} />}
                    size={'small'}
                  >
                    {translate('docEditor.table.filters')}
                    {activeView.filters.length > 0 ? ` · ${activeView.filters.length}` : ''}
                  </Button>
                </Popover>

                <Popover
                  nativeButton
                  content={sortPanel}
                  placement={'bottomRight'}
                  trigger={'click'}
                >
                  <Button
                    className={styles.toolbarButton}
                    icon={<ArrowDownWideNarrowIcon size={14} />}
                    size={'small'}
                  >
                    {translate('docEditor.table.sorts')}
                    {activeView.sorts.length > 0 ? ` · ${activeView.sorts.length}` : ''}
                  </Button>
                </Popover>

                <Popover
                  nativeButton
                  content={fieldPanel}
                  placement={'bottomRight'}
                  trigger={'click'}
                >
                  <Button
                    className={styles.toolbarButton}
                    icon={<Columns3Icon size={14} />}
                    size={'small'}
                  >
                    {translate('docEditor.table.fields')}
                  </Button>
                </Popover>

                <Select
                  options={getRowHeightOptions(translate)}
                  size={'small'}
                  style={{ width: 140 }}
                  value={activeView.rowHeight}
                  onChange={(value: TableRowHeight) =>
                    updateActiveView((view) => ({
                      ...view,
                      rowHeight: value,
                    }))
                  }
                />

                <Button
                  className={styles.toolbarButton}
                  icon={<Columns3Icon size={14} />}
                  size={'small'}
                  onClick={handleAddField}
                >
                  {translate('docEditor.table.addColumn')}
                </Button>

                <ActionIcon
                  className={styles.iconButton}
                  disabled={!selectedFieldId}
                  icon={PencilLineIcon}
                  size={16}
                  title={translate('docEditor.table.renameColumnHint')}
                  onClick={() => selectedFieldId && startFieldRename(selectedFieldId)}
                />
                <ActionIcon
                  className={styles.iconButton}
                  disabled={!selectedRecordId || activeRecords.length === 1}
                  icon={Trash2Icon}
                  size={16}
                  title={translate('docEditor.table.deleteRow')}
                  onClick={handleDeleteRecord}
                />
                <ActionIcon
                  className={styles.iconButton}
                  disabled={!selectedFieldId || activeFields.length === 1}
                  icon={EyeOffIcon}
                  size={16}
                  title={translate('docEditor.table.hideField')}
                  onClick={() =>
                    selectedFieldId &&
                    updateActiveView((view) => ({
                      ...view,
                      hiddenFieldIds: Array.from(
                        new Set([...view.hiddenFieldIds, selectedFieldId]),
                      ),
                    }))
                  }
                />
                <ActionIcon
                  className={styles.iconButton}
                  disabled={!selectedFieldId || activeFields.length === 1}
                  icon={Trash2Icon}
                  size={16}
                  title={translate('docEditor.table.deleteColumn')}
                  onClick={() => selectedFieldId && handleDeleteField(selectedFieldId)}
                />
              </Flexbox>
            </Flexbox>

            <DataGrid
              className={cx(styles.grid, theme.appearance === 'dark' ? 'rdg-dark' : 'rdg-light')}
              columns={columns}
              enableVirtualization={projection.records.length > 30}
              headerRowHeight={42}
              key={gridSchemaKey}
              rowHeight={rowHeight}
              rowKeyGetter={(row) => row.id}
              rows={projection.records}
              style={{ height: gridHeight }}
              onRowsChange={handleRowsChange}
              onCellClick={(args: CellMouseArgs<TableRecord>, event) => {
                setSelectedRecordId(args.row.id);
                setSelectedFieldId(
                  args.column.key === ROW_INDEX_COLUMN_KEY ? undefined : args.column.key,
                );

                const field = activeFields.find((item) => item.id === args.column.key);
                if (!field || field.type !== 'checkbox') return;

                event.preventGridDefault();
                updateRecordValue(args.row.id, field, !Boolean(args.row.cells[field.id]));
              }}
              onCellDoubleClick={(args: CellMouseArgs<TableRecord>, event) => {
                event.preventGridDefault();
                setDrawerRecordId(args.row.id);
              }}
              onColumnResize={(column, width) => {
                if (column.key === ROW_INDEX_COLUMN_KEY) return;
                commitTable(updateTableFieldWidths(table, { [column.key]: width }));
              }}
              onSelectedCellChange={(args: CellSelectArgs<TableRecord>) => {
                setSelectedRecordId(args.row?.id);
                setSelectedFieldId(
                  args.column?.key && args.column.key !== ROW_INDEX_COLUMN_KEY
                    ? String(args.column.key)
                    : undefined,
                );
              }}
            />

            <Flexbox className={styles.footer} width={'100%'}>
              <Button
                className={styles.footerButton}
                icon={<Rows3Icon size={14} />}
                size={'small'}
                type={'text'}
                onClick={handleAddRecord}
              >
                {translate('docEditor.table.addRow')}
              </Button>
            </Flexbox>
          </Flexbox>
        </Flexbox>
      </Flexbox>

      <Drawer
        destroyOnHidden
        open={!!drawerRecordId}
        size={420}
        title={getRecordTitle(table, activeRecord) || translate('docEditor.table.recordDetail')}
        onClose={() => setDrawerRecordId(undefined)}
      >
        <Flexbox gap={8}>
          <Text type={'secondary'}>
            {primaryField
              ? translate('docEditor.table.primaryField', { name: primaryField.name })
              : ''}
          </Text>
          {activeRecord &&
            activeFields.map((field) => (
              <Flexbox className={styles.drawerField} key={field.id}>
                <div className={styles.drawerFieldMeta}>
                  <Text strong>{field.name}</Text>
                  <Tag className={styles.fieldTypeTag}>
                    {translate(`docEditor.table.fieldTypes.${field.type}`)}
                  </Tag>
                </div>
                {renderDrawerFieldControl(
                  activeRecord,
                  field,
                  selectOptionsByField[field.id] || [],
                  translate,
                  updateRecordValue,
                )}
              </Flexbox>
            ))}
        </Flexbox>
      </Drawer>
    </>
  );
});

const renderDrawerFieldControl = (
  record: TableRecord,
  field: TableField,
  options: string[],
  translate: TranslateFn,
  onChange: (recordId: string, field: TableField, nextValue: string | boolean) => void,
) => {
  const rawValue = record.cells[field.id];
  const value = typeof rawValue === 'boolean' ? rawValue : String(rawValue ?? '');

  if (field.type === 'checkbox') {
    return (
      <Checkbox
        checked={Boolean(value)}
        onChange={(event) => onChange(record.id, field, event.target.checked)}
      >
        {Boolean(value)
          ? translate('docEditor.table.boolean.true')
          : translate('docEditor.table.boolean.false')}
      </Checkbox>
    );
  }

  if (field.type === 'select') {
    return (
      <AutoComplete
        allowClear
        options={options.map((option) => ({ label: option, value: option }))}
        style={{ width: '100%' }}
        value={value || undefined}
        onChange={(nextValue) => onChange(record.id, field, nextValue || '')}
      >
        <Input />
      </AutoComplete>
    );
  }

  return (
    <Input
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      value={String(value)}
      onChange={(event) => onChange(record.id, field, event.target.value)}
    />
  );
};

const renderFieldValue = (
  field: TableField,
  value: TableCellValue | undefined,
  translate: TranslateFn,
  styles: ReturnType<typeof useStyles>['styles'],
) => {
  if (field.type === 'checkbox') {
    return <Checkbox checked={Boolean(value)} style={{ pointerEvents: 'none' }} />;
  }

  if (field.type === 'select' && value) {
    return <Tag className={styles.fieldTypeTag}>{String(value)}</Tag>;
  }

  if (!value) {
    return (
      <span className={cx(styles.cellValue, styles.emptyValue)}>
        {translate('docEditor.table.emptyValue')}
      </span>
    );
  }

  if (field.type === 'url') {
    return (
      <a className={styles.cellValue} href={String(value)} rel={'noreferrer'} target={'_blank'}>
        {String(value)}
      </a>
    );
  }

  return <span className={styles.cellValue}>{String(value)}</span>;
};

const getFieldTypeItems = (translate: TranslateFn, onSelect: (fieldType: TableFieldType) => void) =>
  (['text', 'number', 'date', 'select', 'checkbox', 'url'] as TableFieldType[]).map(
    (fieldType) => ({
      key: fieldType,
      label: translate(`docEditor.table.fieldTypes.${fieldType}`),
      onClick: () => onSelect(fieldType),
    }),
  );

const getFilterOperatorOptions = (fieldType: TableFieldType, translate: TranslateFn) => {
  if (fieldType === 'checkbox') {
    return [
      { label: translate('docEditor.table.filterOperators.equals'), value: 'equals' },
      { label: translate('docEditor.table.filterOperators.notEquals'), value: 'notEquals' },
    ];
  }

  if (fieldType === 'number' || fieldType === 'date') {
    return [
      { label: translate('docEditor.table.filterOperators.equals'), value: 'equals' },
      { label: translate('docEditor.table.filterOperators.greaterThan'), value: 'greaterThan' },
      { label: translate('docEditor.table.filterOperators.lessThan'), value: 'lessThan' },
      { label: translate('docEditor.table.filterOperators.isEmpty'), value: 'isEmpty' },
      { label: translate('docEditor.table.filterOperators.isNotEmpty'), value: 'isNotEmpty' },
    ];
  }

  return [
    { label: translate('docEditor.table.filterOperators.contains'), value: 'contains' },
    { label: translate('docEditor.table.filterOperators.equals'), value: 'equals' },
    { label: translate('docEditor.table.filterOperators.notEquals'), value: 'notEquals' },
    { label: translate('docEditor.table.filterOperators.isEmpty'), value: 'isEmpty' },
    { label: translate('docEditor.table.filterOperators.isNotEmpty'), value: 'isNotEmpty' },
  ];
};

const getRowHeightOptions = (translate: TranslateFn) => [
  { label: translate('docEditor.table.rowHeights.compact'), value: 'compact' },
  { label: translate('docEditor.table.rowHeights.normal'), value: 'normal' },
  { label: translate('docEditor.table.rowHeights.comfortable'), value: 'comfortable' },
];

const getSortDirectionOptions = (translate: TranslateFn) => [
  { label: translate('docEditor.table.sortDirections.asc'), value: 'asc' },
  { label: translate('docEditor.table.sortDirections.desc'), value: 'desc' },
];

const normalizeFieldValue = (fieldType: TableFieldType, value: unknown): TableCellValue => {
  return normalizeTableCellValue(value, fieldType);
};

const normalizeMarkdownForComparison = (markdown?: string | null) =>
  tableDocumentToMarkdown(normalizeTableDocument(markdown, undefined));

const normalizeMetadataTableForComparison = (rawValue?: unknown) =>
  tableDocumentToMarkdown(normalizeTableDocument(undefined, rawValue));

const shouldPreferMarkdownTableContent = (markdown?: string | null, rawValue?: unknown) =>
  normalizeMarkdownForComparison(markdown) !== normalizeMetadataTableForComparison(rawValue);

const renderFilterValueInput = (
  field: TableField | undefined,
  filter: TableViewFilter,
  translate: TranslateFn,
  onChange: (value: string) => void,
) => {
  if (!field) return null;

  if (field.type === 'checkbox') {
    return (
      <Select
        size={'small'}
        value={filter.value}
        options={[
          { label: translate('docEditor.table.boolean.true'), value: 'true' },
          { label: translate('docEditor.table.boolean.false'), value: 'false' },
        ]}
        onChange={(value) => onChange(value)}
      />
    );
  }

  return (
    <Input
      size={'small'}
      type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
      value={filter.value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
};

TableSheet.displayName = 'TableSheet';

export default TableSheet;
