import { copyToClipboard, createRawModal, Icon } from '@lobehub/ui';
import { App } from 'antd';
import { type ItemType } from 'antd/es/menu/interface';
import {
  BookMinusIcon,
  BookPlusIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FolderInputIcon,
  FolderOutputIcon,
  LinkIcon,
  PencilIcon,
  StarIcon,
  StarOffIcon,
  Trash,
} from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR, { mutate as globalMutate } from 'swr';
import { shallow } from 'zustand/shallow';

import RepoIcon from '@/components/LibIcon';
import { clearTreeFolderCache } from '@/features/ResourceManager/components/LibraryHierarchy';
import { PAGE_FILE_TYPE } from '@/features/ResourceManager/constants';
import { useResourceShareModal, useSpaceCapabilities } from '@/features/ResourceSharing';
import { buildResourcePreviewPath } from '@/features/ResourceSpaces';
import { useAppOrigin } from '@/hooks/useAppOrigin';
import { lambdaClient } from '@/libs/trpc/client';
import { useResourceManagerStore } from '@/routes/(main)/resource/features/store';
import { documentService } from '@/services/document';
import { useFileStore } from '@/store/file';
import { useKnowledgeBaseStore } from '@/store/library';
import { downloadFile } from '@/utils/client/downloadFile';

import MoveToFolderModal from '../MoveToFolderModal';
import MoveToSpaceModal from '../MoveToSpaceModal';

interface UseFileItemDropdownParams {
  enabled?: boolean;
  filename: string;
  fileType: string;
  id: string;
  libraryId?: string;
  onRenameStart?: () => void;
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
  id,
  libraryId,
  url,
  filename,
  fileType,
  sourceType,
  onRenameStart,
}: UseFileItemDropdownParams): UseFileItemDropdownReturn => {
  const { t } = useTranslation(['components', 'common', 'file', 'knowledgeBase']);
  const { message, modal } = App.useApp();
  const appOrigin = useAppOrigin();
  const { open: openShareModal } = useResourceShareModal();
  const spaceId = useResourceManagerStore((s) => s.spaceId);
  const caps = useSpaceCapabilities(spaceId);

  const { deleteResource, moveResource, refreshFileList } = useFileStore(
    (s) => ({
      deleteResource: s.deleteResource,
      moveResource: s.moveResource,
      refreshFileList: s.refreshFileList,
    }),
    shallow,
  );
  const [removeFilesFromKnowledgeBase, addFilesToKnowledgeBase, useFetchKnowledgeBaseList] =
    useKnowledgeBaseStore((s) => [
      s.removeFilesFromKnowledgeBase,
      s.addFilesToKnowledgeBase,
      s.useFetchKnowledgeBaseList,
    ]);

  // Fetch knowledge bases - SWR caches this across all dropdown instances
  // Only the first call fetches from server, subsequent calls use cache
  // The expensive menu computation is deferred until dropdown opens (menuItems is a function)
  const { data: libraries } = useFetchKnowledgeBaseList(spaceId);

  const { data: favoriteIds } = useSWR('resource-favorite-ids', () =>
    lambdaClient.favorite.listFavoriteIds.query(),
  );
  const isFavorited = (favoriteIds ?? []).includes(id);

  const isInLibrary = !!libraryId;
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

  const menuItems = useCallback(() => {
    // Filter out current knowledge base and create submenu items
    const availableKnowledgeBases = (libraries || []).filter((kb) => kb.id !== libraryId);

    // Submenu for adding files to a library (used when NOT in a library)
    const addToKnowledgeBaseSubmenu: ItemType[] = availableKnowledgeBases.map((kb) => ({
      icon: <RepoIcon />,
      key: `add-to-library-${kb.id}`,
      label: <span style={{ marginLeft: 8 }}>{kb.name}</span>,
      onClick: async ({ domEvent }) => {
        domEvent.stopPropagation();
        try {
          await addFilesToKnowledgeBase(kb.id, [id]);
          message.success(
            t('addToKnowledgeBase.addSuccess', {
              count: 1,
              ns: 'knowledgeBase',
            }),
          );
        } catch (e: any) {
          console.error(e);
          // Check for duplicate key error (file already exists in the library)
          // Server throws CONFLICT error code for duplicate entries
          const isDuplicateError =
            e?.data?.code === 'CONFLICT' || e?.message === 'FILE_ALREADY_IN_KNOWLEDGE_BASE';
          if (isDuplicateError) {
            message.warning(t('addToKnowledgeBase.alreadyExists', { ns: 'knowledgeBase' }));
          } else {
            message.error(t('addToKnowledgeBase.error', { ns: 'knowledgeBase' }));
          }
        }
      },
    }));

    // Submenu for moving files to another library (used when IN a library)
    // Move = remove from current library + clear folder relationship + add to target library
    const moveToKnowledgeBaseSubmenu: ItemType[] = availableKnowledgeBases.map((kb) => ({
      icon: <RepoIcon />,
      key: `move-to-library-${kb.id}`,
      label: <span style={{ marginLeft: 8 }}>{kb.name}</span>,
      onClick: async ({ domEvent }) => {
        domEvent.stopPropagation();
        try {
          // First remove from current library
          if (libraryId) {
            await removeFilesFromKnowledgeBase(libraryId, [id]);
          }
          // Clear folder relationship (parentId) since folders are library-specific
          await moveResource(id, null);
          // Then add to target library
          await addFilesToKnowledgeBase(kb.id, [id]);
          message.success(t('moveToKnowledgeBase.success', { ns: 'knowledgeBase' }));
        } catch (e: any) {
          console.error(e);
          const isDuplicateError =
            e?.data?.code === 'CONFLICT' || e?.message === 'FILE_ALREADY_IN_KNOWLEDGE_BASE';
          if (isDuplicateError) {
            message.warning(t('addToKnowledgeBase.alreadyExists', { ns: 'knowledgeBase' }));
          } else {
            message.error(t('moveToKnowledgeBase.error', { ns: 'knowledgeBase' }));
          }
        }
      },
    }));

    const libraryRelatedActions = (
      isInLibrary
        ? [
            availableKnowledgeBases.length > 0 && {
              children: moveToKnowledgeBaseSubmenu,
              icon: <Icon icon={BookPlusIcon} />,
              key: 'moveToOtherLibrary',
              label: t('FileManager.actions.moveToOtherLibrary'),
            },
            {
              icon: <Icon icon={BookMinusIcon} />,
              key: 'removeFromLibrary',
              label: t('FileManager.actions.removeFromLibrary'),
              onClick: async ({ domEvent }) => {
                domEvent.stopPropagation();

                modal.confirm({
                  okButtonProps: {
                    danger: true,
                  },
                  onOk: async () => {
                    await removeFilesFromKnowledgeBase(libraryId, [id]);

                    message.success(t('FileManager.actions.removeFromLibrarySuccess'));
                  },
                  title: t('FileManager.actions.confirmRemoveFromLibrary', {
                    count: 1,
                  }),
                });
              },
            },
          ]
        : [
            availableKnowledgeBases.length > 0 && {
              children: addToKnowledgeBaseSubmenu,
              icon: <Icon icon={BookPlusIcon} />,
              key: 'addToLibrary',
              label: t('FileManager.actions.addToLibrary'),
            },
          ]
    ) as ItemType[];

    const hasKnowledgeBaseActions = libraryRelatedActions.some(Boolean);

    return (
      [
        ...libraryRelatedActions,
        hasKnowledgeBaseActions && {
          type: 'divider',
        },
        isInLibrary &&
          caps.canMove && {
            icon: <Icon icon={FolderInputIcon} />,
            key: 'moveToFolder',
            label: t('FileManager.actions.moveToFolder'),
            onClick: async ({ domEvent }) => {
              domEvent.stopPropagation();

              createRawModal(MoveToFolderModal, {
                fileId: id,
                knowledgeBaseId: libraryId,
              });
            },
          },
        caps.canMove && {
          icon: <Icon icon={FolderOutputIcon} />,
          key: 'moveToSpace',
          label: t('FileManager.actions.moveToSpace'),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();

            createRawModal(MoveToSpaceModal, {
              fileId: id,
              sourceType,
            });
          },
        },
        isFolder &&
          caps.canEdit && {
            icon: <Icon icon={PencilIcon} />,
            key: 'rename',
            label: t('FileManager.actions.rename'),
            onClick: async ({ domEvent }) => {
              domEvent.stopPropagation();
              onRenameStart?.();
            },
          },
        caps.canShareLink && {
          icon: <Icon icon={LinkIcon} />,
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
        !isFolder && {
          icon: <Icon icon={ExternalLinkIcon} />,
          key: 'openInNewTab',
          label: t('FileManager.actions.openInNewTab'),
          onClick: ({ domEvent }) => {
            domEvent.stopPropagation();
            const previewUrl = isPage
              ? `${appOrigin}${buildResourcePreviewPath(spaceId, id, libraryId)}`
              : url;
            window.open(previewUrl, '_blank', 'noopener');
          },
        },
        {
          icon: <Icon icon={LinkIcon} />,
          key: 'copyUrl',
          label: t('FileManager.actions.copyUrl'),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();

            // For pages, use the route path instead of the storage URL
            let urlToCopy = url;
            if (isPage) {
              urlToCopy = `${appOrigin}${buildResourcePreviewPath(spaceId, id, libraryId)}`;
            }

            await copyToClipboard(urlToCopy);
            message.success(t('FileManager.actions.copyUrlSuccess'));
          },
        },
        !isFolder && {
          icon: <Icon icon={DownloadIcon} />,
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
                  message.error('Failed to download page: no content available');
                }
              } catch (error) {
                console.error('Failed to download page:', error);
                message.error('Failed to download page');
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
        sourceType && {
          icon: <Icon icon={isFavorited ? StarOffIcon : StarIcon} />,
          key: 'toggleFavorite',
          label: isFavorited
            ? t('FileManager.actions.unfavorite')
            : t('FileManager.actions.favorite'),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();
            try {
              if (isFavorited) {
                await lambdaClient.favorite.removeFavorite.mutate({ resourceId: id });
                message.success(t('FileManager.actions.unfavoriteSuccess'));
              } else {
                await lambdaClient.favorite.addFavorite.mutate({
                  resourceId: id,
                  sourceType: sourceType as 'file' | 'document',
                });
                message.success(t('FileManager.actions.favoriteSuccess'));
              }
              await globalMutate('resource-favorite-ids');
              await globalMutate('resource-favorites-list');
            } catch {
              message.error(t('FileManager.actions.restoreFailed'));
            }
          },
        },
        caps.canDelete && {
          danger: true,
          icon: <Icon icon={Trash} />,
          key: 'delete',
          label: t('delete', { ns: 'common' }),
          onClick: async ({ domEvent }) => {
            domEvent.stopPropagation();

            // Documents (non-folder) support soft-delete → undo toast instead of confirm
            const isDocument = sourceType === 'document' && !isFolder;

            if (isDocument) {
              // Optimistic delete first
              await deleteResource(id);
              if (libraryId) await clearTreeFolderCache(libraryId);
              await refreshFileList();

              // Show undo toast (5 s window)
              const undoKey = `undo-delete-${id}`;
              message.open({
                content: (
                  <span>
                    {t('FileManager.actions.deleteSuccess')}{' '}
                    <a
                      style={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={async () => {
                        message.destroy(undoKey);
                        try {
                          await documentService.restoreDocument(id);
                          await refreshFileList();
                          message.success(t('FileManager.actions.undoSuccess'));
                        } catch {
                          message.error(t('FileManager.actions.restoreFailed'));
                        }
                      }}
                    >
                      {t('FileManager.actions.undo')}
                    </a>
                  </span>
                ),
                duration: 5,
                key: undoKey,
                type: 'success',
              });
            } else {
              // Files / folders: confirm modal (irreversible hard-delete)
              modal.confirm({
                content: isFolder
                  ? t('FileManager.actions.confirmDeleteFolder')
                  : t('FileManager.actions.confirmDelete'),
                okButtonProps: { danger: true },
                onOk: async () => {
                  await deleteResource(id);
                  if (libraryId) await clearTreeFolderCache(libraryId);
                  await refreshFileList();
                  message.success(t('FileManager.actions.deleteSuccess'));
                },
              });
            }
          },
        },
      ] as ItemType[]
    ).filter(Boolean);
  }, [
    addFilesToKnowledgeBase,
    caps,
    clearTreeFolderCache,
    deleteResource,
    favoriteIds,
    filename,
    id,
    isFavorited,
    isFolder,
    isInLibrary,
    isPage,
    appOrigin,
    libraries,
    libraryId,
    message,
    modal,
    moveResource,
    openShareModal,
    onRenameStart,
    refreshFileList,
    removeFilesFromKnowledgeBase,
    sourceType,
    spaceId,
    t,
    url,
  ]);

  return { menuItems };
};
