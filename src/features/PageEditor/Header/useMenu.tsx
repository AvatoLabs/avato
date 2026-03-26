import { isDesktop } from '@lobechat/const';
import { type DropdownItem } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { App } from 'antd';
import { cssVar, useResponsive } from 'antd-style';
import dayjs from 'dayjs';
import { CopyPlus, Download, Link2, Maximize2, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useDocumentStore } from '@/store/document';
import { editorSelectors } from '@/store/document/slices/editor';
import { useFileStore } from '@/store/file';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { TABLE_PAGE_KIND } from '@/utils/page';

import { usePageEditorStore, useStoreApi } from '../store';

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const normalizeExportFileName = (title: string | undefined, extension: string) =>
  `${
    (title || 'Untitled')
      .trim()
      .replaceAll(/[\\/:*?"<>|]+/g, '-')
      .replaceAll(/\s+/g, ' ') || 'Untitled'
  }.${extension}`;

const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const decodeBase64 = (value: string) => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (const [index, char] of [...binary].entries()) {
    bytes[index] = char.charCodeAt(0);
  }

  return bytes;
};

/**
 * Action menu for the page editor.
 */
export const useMenu = (): { menuItems: any[] } => {
  const { t } = useTranslation(['file', 'common', 'chat']);
  const { message, modal } = App.useApp();
  const storeApi = useStoreApi();
  const { lg = true } = useResponsive();

  const [documentId, pageKind] = usePageEditorStore((s) => [s.documentId, s.pageKind]);
  const isTablePage = pageKind === TABLE_PAGE_KIND;

  // Get lastUpdatedTime from DocumentStore
  const lastUpdatedTime = useDocumentStore((s) =>
    documentId ? editorSelectors.lastUpdatedTime(documentId)(s) : null,
  );

  const duplicateDocument = useFileStore((s) => s.duplicateDocument);

  const [wideScreen, toggleWideScreen] = useGlobalStore((s) => [
    systemStatusSelectors.wideScreen(s),
    s.toggleWideScreen,
  ]);

  // Wide screen mode only makes sense when screen is large enough
  const showViewModeSwitch = lg;

  const handleDuplicate = useCallback(async () => {
    if (!documentId) return;
    try {
      await duplicateDocument(documentId);
      message.success(t('pageEditor.duplicateSuccess'));
    } catch (error) {
      console.error('Failed to duplicate page:', error);
      message.error(t('pageEditor.duplicateError'));
    }
  }, [documentId, duplicateDocument, message, t]);

  const handleExportMarkdown = useCallback(async () => {
    const state = storeApi.getState();
    const { editor, title } = state;

    if (!editor) return;

    try {
      const markdown = (editor.getDocument('markdown') as unknown as string) || '';
      const fileName = normalizeExportFileName(
        title || t(isTablePage ? 'pageList.tableUntitled' : 'pageList.untitled'),
        'md',
      );

      if (isDesktop) {
        const { desktopExportService } = await import('@/services/electron/desktopExportService');
        await desktopExportService.exportMarkdown({
          content: markdown,
          fileName,
        });
      } else {
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        message.success(t('pageEditor.exportSuccess'));
      }
    } catch (error) {
      console.error('Failed to export markdown:', error);
      message.error(t('pageEditor.exportError'));
    }
  }, [isTablePage, message, storeApi, t]);

  const handleExportCsv = useCallback(async () => {
    const state = storeApi.getState();
    const { editor, title } = state;

    if (!editor) return;

    try {
      const markdown = (editor.getDocument('markdown') as unknown as string) || '';
      const { parseMarkdownTable, tableSheetToCsv } = await import('@/utils/pageTable');
      const csv = `\uFEFF${tableSheetToCsv(parseMarkdownTable(markdown))}`;
      const fileName = normalizeExportFileName(title || t('pageList.tableUntitled'), 'csv');

      if (isDesktop) {
        const { desktopExportService } = await import('@/services/electron/desktopExportService');
        await desktopExportService.exportCsv({
          content: csv,
          fileName,
        });
      } else {
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
        message.success(t('pageEditor.exportSuccess'));
      }
    } catch (error) {
      console.error('Failed to export csv:', error);
      message.error(t('pageEditor.exportError'));
    }
  }, [message, storeApi, t]);

  const handleExportXlsx = useCallback(async () => {
    const state = storeApi.getState();
    const { editor, title } = state;

    if (!editor) return;

    try {
      const markdown = (editor.getDocument('markdown') as unknown as string) || '';
      const { parseMarkdownTable, tableSheetToXlsxBase64 } = await import('@/utils/pageTable');
      const base64Content = tableSheetToXlsxBase64(parseMarkdownTable(markdown), title);
      const fileName = normalizeExportFileName(title || t('pageList.tableUntitled'), 'xlsx');

      if (isDesktop) {
        const { desktopExportService } = await import('@/services/electron/desktopExportService');
        await desktopExportService.exportXlsx({
          base64Content,
          fileName,
        });
      } else {
        downloadBlob(new Blob([decodeBase64(base64Content)], { type: XLSX_MIME_TYPE }), fileName);
        message.success(t('pageEditor.exportSuccess'));
      }
    } catch (error) {
      console.error('Failed to export xlsx:', error);
      message.error(t('pageEditor.exportError'));
    }
  }, [message, storeApi, t]);

  const menuItems = useMemo<DropdownItem[]>(() => {
    const exportItems: DropdownItem[] = isTablePage
      ? [
          {
            key: 'export-xlsx',
            label: t('pageEditor.menu.export.xlsx'),
            onClick: handleExportXlsx,
          },
          {
            key: 'export-csv',
            label: t('pageEditor.menu.export.csv'),
            onClick: handleExportCsv,
          },
          {
            key: 'export-markdown',
            label: t('pageEditor.menu.export.markdown'),
            onClick: handleExportMarkdown,
          },
        ]
      : [
          {
            key: 'export-markdown',
            label: t('pageEditor.menu.export.markdown'),
            onClick: handleExportMarkdown,
          },
        ];

    const items: DropdownItem[] = [
      ...(showViewModeSwitch
        ? [
            {
              checked: wideScreen,
              icon: <Icon icon={Maximize2} />,
              key: 'full-width',
              label: t('viewMode.fullWidth', { ns: 'chat' }),
              onCheckedChange: toggleWideScreen,
              type: 'switch' as const,
            },
            {
              type: 'divider' as const,
            },
          ]
        : []),
      {
        icon: <Icon icon={CopyPlus} />,
        key: 'duplicate',
        label: t('pageList.duplicate'),
        onClick: handleDuplicate,
      },
      {
        icon: <Icon icon={Link2} />,
        key: 'copy-link',
        label: t('pageEditor.menu.copyLink'),
        onClick: () => {
          const state = storeApi.getState();
          state.handleCopyLink(t as any, message);
        },
      },
      {
        danger: true,
        icon: <Icon icon={Trash2} />,
        key: 'delete',
        label: t('delete', { ns: 'common' }),
        onClick: async () => {
          const state = storeApi.getState();
          await state.handleDelete(t as any, message, modal, state.onDelete);
        },
      },
      {
        type: 'divider' as const,
      },
      {
        children: exportItems,
        icon: <Icon icon={Download} />,
        key: 'export',
        label: t('pageEditor.menu.export'),
      },
    ];

    if (lastUpdatedTime) {
      items.push(
        {
          type: 'divider' as const,
        },
        {
          disabled: true,
          key: 'page-info',
          label: (
            <div style={{ color: cssVar.colorTextTertiary, fontSize: 12, lineHeight: 1.6 }}>
              <div>
                {lastUpdatedTime
                  ? t('pageEditor.editedAt', {
                      time: dayjs(lastUpdatedTime).format('MMMM D, YYYY [at] h:mm A'),
                    })
                  : ''}
              </div>
            </div>
          ),
        },
      );
    }
    return items;
  }, [
    lastUpdatedTime,
    storeApi,
    t,
    message,
    modal,
    wideScreen,
    toggleWideScreen,
    showViewModeSwitch,
    handleDuplicate,
    handleExportCsv,
    handleExportMarkdown,
    handleExportXlsx,
    isTablePage,
  ]);

  return { menuItems };
};
