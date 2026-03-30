import { isDesktop } from '@lobechat/const';
import { type DropdownItem } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { App } from 'antd';
import { cssVar, useResponsive } from 'antd-style';
import dayjs from 'dayjs';
import { CopyPlus, Download, Link2, Maximize2, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { pageSelectors, usePageStore } from '@/store/docs';
import { revalidatePageDocuments } from '@/store/docs/slices/list/action';
import { useDocumentStore } from '@/store/document';
import { editorSelectors } from '@/store/document/slices/editor';
import { useFileStore } from '@/store/file';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useSourceSetStore } from '@/store/sourceSet';
import { TABLE_PAGE_KIND } from '@/utils/docs';

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
  const { t } = useTranslation(['file', 'common', 'chat', 'components', 'sourceSet']);
  const { message, modal } = App.useApp();
  const storeApi = useStoreApi();
  const { lg = true } = useResponsive();

  const [documentId, pageKind] = usePageEditorStore((s) => [s.documentId, s.pageKind]);
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const pageDocument = usePageStore(pageSelectors.getDocumentById(documentId));
  const [refreshDocuments, internalDispatchDocuments] = usePageStore((s) => [
    s.refreshDocuments,
    s.internal_dispatchDocuments,
  ]);
  const sourceSetId = pageDocument?.sourceSetId ?? undefined;
  const spaceId = pageDocument?.spaceId ?? undefined;

  // Get lastUpdatedTime from DocumentStore
  const lastUpdatedTime = useDocumentStore((s) =>
    documentId ? editorSelectors.lastUpdatedTime(documentId)(s) : null,
  );

  const [duplicateDocument, moveContentItem] = useFileStore((s) => [
    s.duplicateDocument,
    s.moveContentItem,
  ]);
  const [addFilesToSourceSet, removeFilesFromSourceSet, useFetchSourceSetList] = useSourceSetStore(
    (s) => [s.addFilesToSourceSet, s.removeFilesFromSourceSet, s.useFetchSourceSetList],
  );
  const { data: sourceSets = [] } = useFetchSourceSetList(spaceId);
  const availableSourceSets = useMemo(
    () => sourceSets.filter((item) => item.id !== sourceSetId),
    [sourceSetId, sourceSets],
  );

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
      message.success(t('docEditor.duplicateSuccess'));
    } catch (error) {
      console.error('Failed to duplicate page:', error);
      message.error(t('docEditor.duplicateError'));
    }
  }, [documentId, duplicateDocument, message, t]);

  const syncSourceAssignments = useCallback(
    async (nextSourceSetId?: string) => {
      if (documentId && pageDocument) {
        internalDispatchDocuments({
          document: {
            ...pageDocument,
            sourceSetId: nextSourceSetId ?? null,
          },
          id: documentId,
          type: 'updateDocument',
        });
      }

      storeApi.setState({ sourceSetId: nextSourceSetId }, false);

      await Promise.all([refreshDocuments(), revalidatePageDocuments()]);
    },
    [documentId, internalDispatchDocuments, pageDocument, refreshDocuments, storeApi],
  );

  const handleAddToSourceSet = useCallback(
    async (targetSourceSetId: string) => {
      if (!documentId) return;

      try {
        await addFilesToSourceSet(targetSourceSetId, [documentId]);
        await syncSourceAssignments(targetSourceSetId);
        message.success(t('addToSourceSet.addSuccess', { count: 1, ns: 'sourceSet' }));
      } catch (error: any) {
        console.error(error);
        const isDuplicateError =
          error?.data?.code === 'CONFLICT' || error?.message === 'FILE_ALREADY_IN_KNOWLEDGE_BASE';

        if (isDuplicateError) {
          message.warning(t('addToSourceSet.alreadyExists', { ns: 'sourceSet' }));
        } else {
          message.error(t('addToSourceSet.error', { ns: 'sourceSet' }));
        }
      }
    },
    [addFilesToSourceSet, documentId, message, syncSourceAssignments, t],
  );

  const handleMoveToSourceSet = useCallback(
    async (targetSourceSetId: string) => {
      if (!documentId || !sourceSetId) return;

      try {
        await removeFilesFromSourceSet(sourceSetId, [documentId]);
        await moveContentItem(documentId, null);
        await addFilesToSourceSet(targetSourceSetId, [documentId]);
        await syncSourceAssignments(targetSourceSetId);
        message.success(t('moveToSourceSet.success', { ns: 'sourceSet' }));
      } catch (error) {
        console.error(error);
        message.error(t('moveToSourceSet.error', { ns: 'sourceSet' }));
      }
    },
    [
      addFilesToSourceSet,
      documentId,
      message,
      moveContentItem,
      removeFilesFromSourceSet,
      sourceSetId,
      syncSourceAssignments,
      t,
    ],
  );

  const handleRemoveFromSourceSet = useCallback(() => {
    if (!documentId || !sourceSetId) return;

    modal.confirm({
      okButtonProps: { danger: true },
      onOk: async () => {
        await removeFilesFromSourceSet(sourceSetId, [documentId]);
        await syncSourceAssignments(undefined);
        message.success(t('FileManager.actions.removeFromSourceSetSuccess', { ns: 'components' }));
      },
      title: t('FileManager.actions.confirmRemoveFromSourceSet', { count: 1, ns: 'components' }),
    });
  }, [documentId, message, modal, removeFilesFromSourceSet, sourceSetId, syncSourceAssignments, t]);

  const handleExportMarkdown = useCallback(async () => {
    const state = storeApi.getState();
    const { editor, title } = state;

    if (!editor) return;

    try {
      const markdown = (editor.getDocument('markdown') as unknown as string) || '';
      let content = markdown;

      if (isTablePage && documentId) {
        const document = usePageStore.getState().documents?.find((item) => item.id === documentId);
        const { normalizeTableDocument, tableDocumentToMarkdown } =
          await import('@/utils/tableDocument');
        const table = normalizeTableDocument(markdown, document?.metadata?.table);
        content = tableDocumentToMarkdown(table, { activeViewOnly: true });
      }

      const fileName = normalizeExportFileName(
        title || t(isTablePage ? 'pageList.tableUntitled' : 'pageList.untitled'),
        'md',
      );

      if (isDesktop) {
        const { desktopExportService } = await import('@/services/electron/desktopExportService');
        await desktopExportService.exportMarkdown({
          content,
          fileName,
        });
      } else {
        const blob = new Blob([content], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.append(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        message.success(t('docEditor.exportSuccess'));
      }
    } catch (error) {
      console.error('Failed to export markdown:', error);
      message.error(t('docEditor.exportError'));
    }
  }, [documentId, isTablePage, message, storeApi, t]);

  const handleExportCsv = useCallback(async () => {
    const state = storeApi.getState();
    const { editor, title } = state;

    if (!editor) return;

    try {
      const markdown = (editor.getDocument('markdown') as unknown as string) || '';
      const document = documentId
        ? usePageStore.getState().documents?.find((item) => item.id === documentId)
        : undefined;
      const { normalizeTableDocument, tableDocumentToCsv } = await import('@/utils/tableDocument');
      const table = normalizeTableDocument(markdown, document?.metadata?.table);
      const csv = `\uFEFF${tableDocumentToCsv(table, { activeViewOnly: true })}`;
      const fileName = normalizeExportFileName(title || t('pageList.tableUntitled'), 'csv');

      if (isDesktop) {
        const { desktopExportService } = await import('@/services/electron/desktopExportService');
        await desktopExportService.exportCsv({
          content: csv,
          fileName,
        });
      } else {
        downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
        message.success(t('docEditor.exportSuccess'));
      }
    } catch (error) {
      console.error('Failed to export csv:', error);
      message.error(t('docEditor.exportError'));
    }
  }, [documentId, message, storeApi, t]);

  const handleExportXlsx = useCallback(async () => {
    const state = storeApi.getState();
    const { editor, title } = state;

    if (!editor) return;

    try {
      const markdown = (editor.getDocument('markdown') as unknown as string) || '';
      const document = documentId
        ? usePageStore.getState().documents?.find((item) => item.id === documentId)
        : undefined;
      const { normalizeTableDocument, tableDocumentToXlsxBase64 } =
        await import('@/utils/tableDocument');
      const table = normalizeTableDocument(markdown, document?.metadata?.table);
      const base64Content = tableDocumentToXlsxBase64(table, title, { activeViewOnly: true });
      const fileName = normalizeExportFileName(title || t('pageList.tableUntitled'), 'xlsx');

      if (isDesktop) {
        const { desktopExportService } = await import('@/services/electron/desktopExportService');
        await desktopExportService.exportXlsx({
          base64Content,
          fileName,
        });
      } else {
        downloadBlob(new Blob([decodeBase64(base64Content)], { type: XLSX_MIME_TYPE }), fileName);
        message.success(t('docEditor.exportSuccess'));
      }
    } catch (error) {
      console.error('Failed to export xlsx:', error);
      message.error(t('docEditor.exportError'));
    }
  }, [documentId, message, storeApi, t]);

  const menuItems = useMemo<DropdownItem[]>(() => {
    const exportItems: DropdownItem[] = isTablePage
      ? [
          {
            key: 'export-xlsx',
            label: t('docEditor.menu.export.xlsx'),
            onClick: handleExportXlsx,
          },
          {
            key: 'export-csv',
            label: t('docEditor.menu.export.csv'),
            onClick: handleExportCsv,
          },
          {
            key: 'export-markdown',
            label: t('docEditor.menu.export.markdown'),
            onClick: handleExportMarkdown,
          },
        ]
      : [
          {
            key: 'export-markdown',
            label: t('docEditor.menu.export.markdown'),
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
        label: t('docEditor.menu.copyLink'),
        onClick: () => {
          const state = storeApi.getState();
          state.handleCopyLink(t as any, message);
        },
      },
      ...((sourceSetId || availableSourceSets.length > 0)
        ? [
            {
              type: 'divider' as const,
            },
            ...(sourceSetId
              ? [
                  ...(availableSourceSets.length > 0
                    ? [
                        {
                          children: availableSourceSets.map((sourceSet) => ({
                            key: `move-to-source-set-${sourceSet.id}`,
                            label: sourceSet.name,
                            onClick: () => void handleMoveToSourceSet(sourceSet.id),
                          })),
                          icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />,
                          key: 'move-to-source-set',
                          label: t('FileManager.actions.moveToOtherSourceSet', {
                            ns: 'components',
                          }),
                        },
                      ]
                    : []),
                  {
                    icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetRemove} />,
                    key: 'remove-from-source-set',
                    label: t('FileManager.actions.removeFromSourceSet', { ns: 'components' }),
                    onClick: handleRemoveFromSourceSet,
                  },
                ]
              : [
                  {
                    children: availableSourceSets.map((sourceSet) => ({
                      key: `add-to-source-set-${sourceSet.id}`,
                      label: sourceSet.name,
                      onClick: () => void handleAddToSourceSet(sourceSet.id),
                    })),
                    icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />,
                    key: 'add-to-source-set',
                    label: t('FileManager.actions.addToSourceSet', { ns: 'components' }),
                  },
                ]),
          ]
        : []),
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
        label: t('docEditor.menu.export'),
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
                  ? t('docEditor.editedAt', {
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
    sourceSetId,
    availableSourceSets,
    wideScreen,
    toggleWideScreen,
    showViewModeSwitch,
    handleAddToSourceSet,
    handleDuplicate,
    handleExportCsv,
    handleExportMarkdown,
    handleExportXlsx,
    handleMoveToSourceSet,
    handleRemoveFromSourceSet,
    isTablePage,
  ]);

  return { menuItems };
};
