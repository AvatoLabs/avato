import { copyToClipboard, createRawModal, Icon } from '@lobehub/ui';
import { App } from 'antd';
import { type ItemType } from 'antd/es/menu/interface';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { shallow } from 'zustand/shallow';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { clearTreeFolderCache } from '@/features/ContentManager/components/SourceSetTree';
import { PAGE_FILE_TYPE } from '@/features/ContentManager/constants';
import { useOpenFileDocument } from '@/features/ContentManager/hooks/useOpenFileDocument';
import { isMarkdownContentFile } from '@/features/ContentManager/utils/isMarkdownContentFile';
import { useResourceShareModal } from '@/features/ResourceSharing';
import { buildContentPreviewPath } from '@/features/ResourceSpaces';
import { useAppOrigin } from '@/hooks/useAppOrigin';
import { useContentManagerStore } from '@/routes/(main)/content/features/store';
import { documentService } from '@/services/document';
import { useFileStore } from '@/store/file';
import { useSourceSetStore } from '@/store/sourceSet';
import { downloadFile } from '@/utils/client/downloadFile';

import MoveToFolderModal from '../MoveToFolderModal';

interface UseFileItemDropdownParams {
  enabled?: boolean;
  fileId?: string | null;
  filename: string;
  fileType: string;
  id: string;
  onRenameStart?: () => void;
  sourceSetId?: string;
  sourceType?: string;
  url: string;
}

interface UseFileItemDropdownReturn {
  menuItems: () => ItemType[];
}

/**
 * Shared with folder tree and explorer
 */
export const useFileItemDropdown = ({
  fileId,
  id,
  sourceSetId,
  url,
  filename,
  fileType,
  sourceType,
  onRenameStart,
}: UseFileItemDropdownParams): UseFileItemDropdownReturn => {
  const { t } = useTranslation(['components', 'common', 'file', 'sourceSet']);
  const { message, modal } = App.useApp();
  const appOrigin = useAppOrigin();
  const { open: openShareModal } = useResourceShareModal();
  const spaceId = useContentManagerStore((s) => s.spaceId);

  const { deleteContentItem, moveContentItem, refreshFileList } = useFileStore(
    (s) => ({
      deleteContentItem: s.deleteContentItem,
      moveContentItem: s.moveContentItem,
      refreshFileList: s.refreshFileList,
    }),
    shallow,
  );
  const [removeFilesFromSourceSet, addFilesToSourceSet, useFetchSourceSetList] = useSourceSetStore(
    (s) => [s.removeFilesFromSourceSet, s.addFilesToSourceSet, s.useFetchSourceSetList],
  );

  // Fetch knowledge bases - SWR caches this across all dropdown instances
  // Only the first call fetches from server, subsequent calls use cache
  // The expensive menu computation is deferred until dropdown opens (menuItems is a function)
  const { data: libraries } = useFetchSourceSetList(spaceId);

  const isInSourceSet = !!sourceSetId;
  const isFolder = fileType === 'custom/folder';
  // PDF and Office files should not be treated as pages
  const lowerFilename = filename?.toLowerCase();
  const isPDF = fileType?.toLowerCase() === 'pdf' || lowerFilename?.endsWith('.pdf');
  const isOfficeFile =
    lowerFilename?.endsWith('.xls') ||
    lowerFilename?.endsWith('.xlsx') ||
    lowerFilename?.endsWith('.doc') ||
    lowerFilename?.endsWith('.docx') ||
    lowerFilename?.endsWith('.ppt') ||
    lowerFilename?.endsWith('.pptx') ||
    lowerFilename?.endsWith('.odt');
  const isPage =
    !isPDF && !isOfficeFile && (sourceType === 'document' || fileType === PAGE_FILE_TYPE);
  const canOpenInDocumentEditor = !isPage && !isFolder && isMarkdownContentFile(filename, fileType);
  const openFileDocument = useOpenFileDocument({ fileId, id });

  const menuItems = useCallback(() => {
    const availableSourceSets = (libraries || []).filter(
      (sourceSet) => sourceSet.id !== sourceSetId,
    );

    const addToSourceSetSubmenu: ItemType[] = availableSourceSets.map((sourceSet) => ({
      icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSet} />,
      key: `add-to-source-set-${sourceSet.id}`,
      label: <span style={{ marginLeft: 8 }}>{sourceSet.name}</span>,
      onClick: async ({ domEvent }) => {
        domEvent.stopPropagation();
        try {
          await addFilesToSourceSet(sourceSet.id, [id]);
          message.success(
            t('addToSourceSet.addSuccess', {
              count: 1,
              ns: 'sourceSet',
            }),
          );
        } catch (e: any) {
          console.error(e);
          // Check for duplicate key error (file already exists in the library)
          // Server throws CONFLICT error code for duplicate entries
          const isDuplicateError =
            e?.data?.code === 'CONFLICT' || e?.message === 'FILE_ALREADY_IN_KNOWLEDGE_BASE';
          if (isDuplicateError) {
            message.warning(t('addToSourceSet.alreadyExists', { ns: 'sourceSet' }));
          } else {
            message.error(t('addToSourceSet.error', { ns: 'sourceSet' }));
          }
        }
      },
    }));

    // Move = remove from the current source set, clear folder scope, then attach to the target source set.
    const moveToSourceSetSubmenu: ItemType[] = availableSourceSets.map((sourceSet) => ({
      icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSet} />,
      key: `move-to-source-set-${sourceSet.id}`,
      label: <span style={{ marginLeft: 8 }}>{sourceSet.name}</span>,
      onClick: async ({ domEvent }) => {
        domEvent.stopPropagation();
        try {
          if (sourceSetId) {
            await removeFilesFromSourceSet(sourceSetId, [id]);
          }
          // Folders are source-set scoped, so clear parentId before re-attaching.
          await moveContentItem(id, null);
          await addFilesToSourceSet(sourceSet.id, [id]);
          message.success(t('moveToSourceSet.success', { ns: 'sourceSet' }));
        } catch (e: any) {
          console.error(e);
          const isDuplicateError =
            e?.data?.code === 'CONFLICT' || e?.message === 'FILE_ALREADY_IN_KNOWLEDGE_BASE';
          if (isDuplicateError) {
            message.warning(t('addToSourceSet.alreadyExists', { ns: 'sourceSet' }));
          } else {
            message.error(t('moveToSourceSet.error', { ns: 'sourceSet' }));
          }
        }
      },
    }));

    const sourceSetActions = (
      isInSourceSet
        ? [
            availableSourceSets.length > 0 && {
              children: moveToSourceSetSubmenu,
              icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />,
              key: 'moveToSourceSet',
              label: t('FileManager.actions.moveToOtherSourceSet'),
            },
            {
              icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetRemove} />,
              key: 'removeFromSourceSet',
              label: t('FileManager.actions.removeFromSourceSet'),
              onClick: async ({ domEvent }) => {
                domEvent.stopPropagation();

                modal.confirm({
                  okButtonProps: {
                    danger: true,
                  },
                  onOk: async () => {
                    await removeFilesFromSourceSet(sourceSetId, [id]);

                    message.success(t('FileManager.actions.removeFromSourceSetSuccess'));
                  },
                  title: t('FileManager.actions.confirmRemoveFromSourceSet', {
                    count: 1,
                  }),
                });
              },
            },
          ]
        : [
            availableSourceSets.length > 0 && {
              children: addToSourceSetSubmenu,
              icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />,
              key: 'addToSourceSet',
              label: t('FileManager.actions.addToSourceSet'),
            },
          ]
    ) as ItemType[];

    const hasSourceSetActions = sourceSetActions.some(Boolean);

    return (
      [
        ...sourceSetActions,
        hasSourceSetActions && {
          type: 'divider',
        },
        isInSourceSet && {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.folderMove} />,
          key: 'moveToFolder',
          label: t('FileManager.actions.moveToFolder'),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();

            createRawModal(MoveToFolderModal, {
              fileId: id,
              sourceSetId,
            });
          },
        },
        canOpenInDocumentEditor && {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.edit} />,
          key: 'openInDocumentEditor',
          label: t('preview.editAsDocument', { ns: 'file' }),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();

            try {
              await openFileDocument();
            } catch (error) {
              console.error('Failed to open markdown in document editor:', error);
              message.error(t('FileManager.actions.openDocumentError'));
            }
          },
        },
        {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.edit} />,
          key: 'rename',
          label: t('FileManager.actions.rename'),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();
            onRenameStart?.();
          },
        },
        {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.share} />,
          key: 'share',
          label: t('share.title', { ns: 'file' }),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();
            openShareModal({
              id,
              kind: sourceType === 'document' ? 'document' : 'file',
              name: filename,
            });
          },
        },
        {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.link} />,
          key: 'copyUrl',
          label: t('FileManager.actions.copyUrl'),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();

            // For pages, use the route path instead of the storage URL
            let urlToCopy = url;
            if (isPage) {
              urlToCopy = `${appOrigin}${buildContentPreviewPath(spaceId, id, sourceSetId)}`;
            } else if (urlToCopy.startsWith('/')) {
              urlToCopy = new URL(urlToCopy, `${appOrigin}/`).href;
            }

            await copyToClipboard(urlToCopy);
            message.success(t('FileManager.actions.copyUrlSuccess'));
          },
        },
        !isFolder && {
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.download} />,
          key: 'download',
          label: t('download', { ns: 'common' }),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();
            const key = 'file-downloading';
            message.loading({
              content: t('FileManager.actions.downloading'),
              duration: 0,
              key,
            });

            if (isPage) {
              // For pages, download as markdown
              try {
                const doc = await documentService.getDocumentById(id);
                if (doc?.content) {
                  // Add title as markdown heading
                  const title = doc.title || filename;
                  const contentWithTitle = `# ${title}\n\n${doc.content}`;

                  // Create a blob with the markdown content including title
                  const blob = new Blob([contentWithTitle], { type: 'text/markdown' });
                  const blobUrl = URL.createObjectURL(blob);

                  // Ensure filename has .md extension
                  const mdFilename = filename.endsWith('.md') ? filename : `${filename}.md`;

                  await downloadFile(blobUrl, mdFilename);
                  URL.revokeObjectURL(blobUrl);
                } else {
                  message.error(t('pageList.downloadPageNoContent', { ns: 'file' }));
                }
              } catch (error) {
                console.error('Failed to download page:', error);
                message.error(t('pageList.downloadPageFailed', { ns: 'file' }));
              }
            } else {
              // For regular files, download from URL
              await downloadFile(url, filename);
            }

            message.destroy(key);
          },
        },
        {
          type: 'divider',
        },
        {
          danger: true,
          icon: <Icon icon={RESOURCE_ENTRY_ICONS.trash} />,
          key: 'delete',
          label: t('delete', { ns: 'common' }),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();
            modal.confirm({
              content: isFolder
                ? t('FileManager.actions.confirmDeleteFolder')
                : t('FileManager.actions.confirmDelete'),
              okButtonProps: { danger: true },
              onOk: async () => {
                // Use optimistic delete - instant UI update, sync in background
                await deleteContentItem(id);

                // Ensure tree caches stay in sync with explorer
                if (sourceSetId) {
                  await clearTreeFolderCache(sourceSetId);
                }
                await refreshFileList();

                message.success(t('FileManager.actions.deleteSuccess'));
              },
            });
          },
        },
      ] as ItemType[]
    ).filter(Boolean);
  }, [
    addFilesToSourceSet,
    canOpenInDocumentEditor,
    deleteContentItem,
    filename,
    id,
    isFolder,
    isInSourceSet,
    isPage,
    appOrigin,
    libraries,
    sourceSetId,
    message,
    modal,
    moveContentItem,
    openFileDocument,
    openShareModal,
    onRenameStart,
    refreshFileList,
    removeFilesFromSourceSet,
    sourceType,
    spaceId,
    t,
    url,
  ]);

  return { menuItems };
};
