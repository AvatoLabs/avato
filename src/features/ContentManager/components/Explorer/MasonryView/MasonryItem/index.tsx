import { Checkbox, showContextMenu, stopPropagation, Tag, Text } from '@lobehub/ui';
import { App } from 'antd';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { shallow } from 'zustand/shallow';

import InlineRename from '@/components/InlineRename';
import { clearTreeFolderCache } from '@/features/ContentManager/components/SourceSetTree/treeState';
import { buildFileAssetBadges } from '@/features/ContentManager/utils/buildFileAssetBadges';
import { buildFileGovernanceActivity } from '@/features/ContentManager/utils/buildFileGovernanceActivity';
import { resolveResourceKind } from '@/features/ContentManager/utils/resolveResourceKind';
import {
  getTransparentDragImage,
  useDragActive,
  useDragState,
} from '@/routes/(main)/content/features/DndContextWrapper';
import { documentService } from '@/services/document';
import { useFileStore } from '@/store/file';
import { sourceSetSelectors, useSourceSetStore } from '@/store/sourceSet';
import { type FileListItem } from '@/types/files';
import { type FileUploadStatus } from '@/types/files/upload';

import { useFileItemClick } from '../../hooks/useFileItemClick';
import DropdownMenu from '../../ItemDropdown/DropdownMenu';
import { useFileItemDropdown } from '../../ItemDropdown/useFileItemDropdown';
import { getInlineUploadStatusKey } from '../../items';
import DefaultFileItem from './DefaultFileItem';
import ImageFileItem from './ImageFileItem';
import MarkdownFileItem from './MarkdownFileItem';
import NoteFileItem from './NoteFileItem';

// Image file types
const IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const MARKDOWN_PREVIEW_MAX_LENGTH = 4000;

// Helper function to extract text from editor's JSON format for preview
const extractTextFromEditorJSON = (editorData: any): string => {
  if (!editorData || !editorData.root || !editorData.root.children) {
    return '';
  }

  const extractFromNode = (node: any): string => {
    if (!node) return '';

    // If node has text, return it
    if (node.text) return node.text;

    // If node has children, recursively extract text
    if (node.children && Array.isArray(node.children)) {
      return node.children.map((child: any) => extractFromNode(child)).join('');
    }

    return '';
  };

  return editorData.root.children.map((node: any) => extractFromNode(node)).join('\n');
};

const truncateMarkdownPreview = (content: string, maxLength = MARKDOWN_PREVIEW_MAX_LENGTH) => {
  if (content.length <= maxLength) return content;

  const lastLineBreak = content.lastIndexOf('\n', maxLength);
  const sliceEnd = lastLineBreak > maxLength * 0.6 ? lastLineBreak : maxLength;

  return `${content.slice(0, sliceEnd).trimEnd()}\n\n...`;
};

const styles = createStaticStyles(({ css }) => ({
  actions: css`
    opacity: 0;
    transition: opacity ${cssVar.motionDurationMid};
  `,
  card: css`
    cursor: pointer;

    position: relative;

    overflow: hidden;

    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgContainer};

    transition:
      border-color ${cssVar.motionDurationMid},
      box-shadow ${cssVar.motionDurationMid},
      background-color ${cssVar.motionDurationMid};

    &:hover {
      border-color: ${cssVar.colorPrimary};
      box-shadow: ${cssVar.boxShadowTertiary};

      .actions {
        opacity: 1;
      }

      .checkbox {
        opacity: 1;
      }

      .dropdown {
        opacity: 1;
      }

      .floatingChunkBadge {
        opacity: 1;
      }
    }
  `,
  checkbox: css`
    position: absolute;
    z-index: 2;
    inset-block-start: 8px;
    inset-inline-start: 8px;

    opacity: 0;

    transition: opacity ${cssVar.motionDurationMid};
  `,
  content: css`
    position: relative;
  `,
  contentWithPadding: css`
    padding: 12px;
  `,
  governanceBadges: css`
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    padding-block: 0 12px;
    padding-inline: 12px;
  `,
  dragOver: css`
    border-color: ${cssVar.colorText} !important;
    color: ${cssVar.colorBgElevated} !important;
    background-color: ${cssVar.colorText} !important;

    * {
      color: ${cssVar.colorBgElevated} !important;
    }
  `,
  dragging: css`
    will-change: transform;
    opacity: 0.5;
  `,
  dropdown: css`
    position: absolute;
    z-index: 2;
    inset-block-start: 8px;
    inset-inline-end: 8px;

    opacity: 0;

    transition: opacity ${cssVar.motionDurationMid};
  `,
  selected: css`
    border-color: ${cssVar.colorPrimary};
    background: ${cssVar.colorPrimaryBg};

    .checkbox {
      opacity: 1;
    }
  `,
  uploadBadge: css`
    position: absolute;
    z-index: 2;
    inset-block-end: 8px;
    inset-inline: 8px;

    padding-block: 4px;
    padding-inline: 8px;
    border-radius: ${cssVar.borderRadiusSM};

    background: ${cssVar.colorFillQuaternary};
    backdrop-filter: blur(4px);
  `,
}));

interface MasonryFileItemProps extends FileListItem {
  onOpen?: (id: string) => void;
  onSelectedChange: (id: string, selected: boolean) => void;
  selected?: boolean;
  slug?: string | null;
  sourceSetId?: string;
  uploadStatus?: FileUploadStatus;
}

const MasonryFileItem = memo<MasonryFileItemProps>(
  ({
    chunkingError,
    embeddingError,
    embeddingStatus,
    finishEmbedding,
    chunkCount,
    assetClassification,
    assetLatestGovernanceAuditAction,
    assetLatestGovernanceAuditActorDisplayName,
    assetLatestGovernanceAuditAt,
    assetLatestGovernanceAuditAfter,
    assetLatestGovernanceAuditBefore,
    assetLatestGovernanceAuditChangedFields,
    assetPrimaryRenditionKind,
    assetPrimaryRenditionLabel,
    assetReviewStatus,
    assetRenditionCount,
    assetUsagePolicy,
    assetVersionLabel,
    url,
    name,
    fileType,
    id,
    selected,
    chunkingStatus,
    onSelectedChange,
    sourceSetId,
    size,
    onOpen,
    metadata,
    sourceType,
    slug,
    sourceSetIds,
    fileId,
    uploadStatus,
  }) => {
    const { t } = useTranslation(['components', 'file']);
    const { message } = App.useApp();
    const [markdownContent, setMarkdownContent] = useState<string>('');
    const [isLoadingMarkdown, setIsLoadingMarkdown] = useState(false);
    const getSourceSetNameById = useCallback(
      (id: string) => sourceSetSelectors.getSourceSetNameById(id)(useSourceSetStore.getState()),
      [],
    );

    const [isRenaming, setIsRenaming] = useState(false);

    // Get file store actions
    const fileStoreState = useFileStore(
      (s) => ({
        refreshFileList: s.refreshFileList,
        updateContentItem: s.updateContentItem,
      }),
      shallow,
    );

    const isDragActive = useDragActive();
    const { setCurrentDrag } = useDragState();
    const [isDragging, setIsDragging] = useState(false);
    const [isOver, setIsOver] = useState(false);

    // Memoize computed values that don't change
    const computedValues = useMemo(() => {
      const resourceKind = resolveResourceKind({
        fileType,
        name,
      });
      return {
        ...resourceKind,
        isImage: fileType ? IMAGE_TYPES.has(fileType) : false,
      };
    }, [fileType, name]);

    const { isImage, isMarkdown, isPage, isFolder, baseName, extension } = computedValues;
    const isInlineUpload = !!uploadStatus;
    const uploadStatusKey = getInlineUploadStatusKey(uploadStatus);
    const uploadStatusType =
      uploadStatus === 'error' ? 'danger' : uploadStatus === 'cancelled' ? 'warning' : 'secondary';
    const assetBadges = useMemo(
      () =>
        buildFileAssetBadges({
          assetClassification,
          compact: true,
          maxVisible: 3,
          assetPrimaryRenditionKind,
          assetPrimaryRenditionLabel,
          assetReviewStatus,
          assetRenditionCount,
          assetUsagePolicy,
          assetVersionLabel,
          currentSourceSetId: sourceSetId,
          getSourceSetNameById,
          sourceSetIds,
          t,
        }),
      [
        assetClassification,
        assetPrimaryRenditionKind,
        assetPrimaryRenditionLabel,
        assetReviewStatus,
        assetRenditionCount,
        assetUsagePolicy,
        assetVersionLabel,
        getSourceSetNameById,
        sourceSetId,
        sourceSetIds,
        t,
      ],
    );
    const governanceActivity = useMemo(
      () =>
        buildFileGovernanceActivity({
          action: assetLatestGovernanceAuditAction,
          actorDisplayName: assetLatestGovernanceAuditActorDisplayName,
          after: assetLatestGovernanceAuditAfter,
          before: assetLatestGovernanceAuditBefore,
          changedFields: assetLatestGovernanceAuditChangedFields,
          createdAt: assetLatestGovernanceAuditAt,
          t,
        }),
      [
        assetLatestGovernanceAuditAction,
        assetLatestGovernanceAuditActorDisplayName,
        assetLatestGovernanceAuditAt,
        assetLatestGovernanceAuditAfter,
        assetLatestGovernanceAuditBefore,
        assetLatestGovernanceAuditChangedFields,
        t,
      ],
    );

    // Use shared click handler hook
    const handleItemClick = useFileItemClick({
      fileId,
      id,
      isFolder,
      isPage,
      sourceSetId,
      onOpen,
      sourceType,
      slug,
    });

    // Memoize drag data to prevent recreation
    const dragData = useMemo(
      () => ({
        fileType,
        isFolder,
        name,
        sourceType,
      }),
      [fileType, isFolder, name, sourceType],
    );

    // Native HTML5 drag event handlers
    const handleDragStart = useCallback(
      (e: React.DragEvent) => {
        if (!sourceSetId) {
          e.preventDefault();
          return;
        }

        setIsDragging(true);
        setCurrentDrag({
          data: dragData,
          id,
          type: isFolder ? 'folder' : 'file',
        });

        // Set drag image to be transparent (we use custom overlay)
        const img = getTransparentDragImage();
        if (img) {
          e.dataTransfer.setDragImage(img, 0, 0);
        }
        e.dataTransfer.effectAllowed = 'move';
      },
      [sourceSetId, dragData, id, isFolder, setCurrentDrag],
    );

    const handleDragEnd = useCallback(() => {
      setIsDragging(false);
    }, []);

    const handleDragOver = useCallback(
      (e: React.DragEvent) => {
        if (!isFolder || !isDragActive) return;

        e.preventDefault();
        e.stopPropagation();
        setIsOver(true);
      },
      [isFolder, isDragActive],
    );

    const handleDragLeave = useCallback(() => {
      setIsOver(false);
    }, []);

    const cardRef = useRef<HTMLDivElement>(null);
    const [isInView, setIsInView] = useState(false);

    // Use Intersection Observer to detect when card enters viewport
    useEffect(() => {
      if (!cardRef.current) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !isInView) {
              setIsInView(true);
            }
          });
        },
        {
          rootMargin: '200px', // Increased margin to load content earlier
          threshold: 0.01, // Lower threshold for earlier triggering
        },
      );

      observer.observe(cardRef.current);

      return () => {
        observer.disconnect();
      };
    }, [isInView]);

    // Fetch markdown content only when in viewport
    useEffect(() => {
      if ((isMarkdown || isPage) && isInView && !markdownContent) {
        setIsLoadingMarkdown(true);

        const fetchContent = async () => {
          try {
            let text: string;

            if (isPage) {
              // For custom pages, fetch from document service
              const page = await documentService.getDocumentById(id);
              const content = page?.content || '';

              // Try to parse as JSON (editor's native format) and convert to markdown for preview
              try {
                const editorData = JSON.parse(content);
                // Since we can't easily convert JSON to markdown here without an editor instance,
                // we'll extract plain text from the JSON structure for preview
                text = extractTextFromEditorJSON(editorData);
              } catch {
                // If it's not JSON, use it as-is (might be old markdown format)
                text = content;
              }
            } else if (url) {
              // For regular markdown files, fetch from URL
              const res = await fetch(url);
              text = await res.text();
            } else {
              text = '';
            }

            // Preserve markdown block boundaries for file previews so tables/code blocks still render.
            const preview = isPage ? text.slice(0, 1000) : truncateMarkdownPreview(text);
            setMarkdownContent(preview);
          } catch (error) {
            console.error('Failed to fetch markdown content:', error);
            setMarkdownContent('');
          } finally {
            setIsLoadingMarkdown(false);
          }
        };

        fetchContent();
      }
    }, [isMarkdown, isPage, url, isInView, markdownContent, id]);

    // Handle rename
    const handleRenameStart = useCallback(() => {
      setIsRenaming(true);
    }, []);

    const handleRenameSave = useCallback(
      async (newName: string) => {
        if (!newName.trim()) {
          message.error(t('FileManager.actions.renameError'));
          return;
        }

        // For files, append extension back; for folders/pages, use the value as-is
        const finalName = isFolder || isPage ? newName.trim() : newName.trim() + extension;

        if (finalName === name) {
          setIsRenaming(false);
          return;
        }

        try {
          await fileStoreState.updateContentItem(id, { name: finalName });
          if (sourceSetId) {
            await clearTreeFolderCache(sourceSetId);
          }
          await fileStoreState.refreshFileList();
          message.success(t('FileManager.actions.renameSuccess'));
          setIsRenaming(false);
        } catch (error) {
          console.error('Rename error:', error);
          message.error(t('FileManager.actions.renameError'));
        }
      },
      [fileStoreState, id, message, name, sourceSetId, t, isFolder, isPage, extension],
    );

    const handleRenameCancel = useCallback(() => {
      setIsRenaming(false);
    }, []);

    const { menuItems } = useFileItemDropdown({
      fileId,
      fileType,
      filename: name,
      id,
      sourceSetId,
      onRenameStart: handleRenameStart,
      sourceType,
      url,
    });
    const contextMenuItems = isInlineUpload ? () => [] : menuItems;

    return (
      <div
        data-drop-target-id={id}
        data-is-folder={String(isFolder)}
        draggable={!isInlineUpload && !!sourceSetId}
        ref={cardRef}
        className={cx(
          styles.card,
          selected && styles.selected,
          isDragging && styles.dragging,
          isOver && styles.dragOver,
        )}
        onDragEnd={handleDragEnd}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDragStart={handleDragStart}
        onContextMenu={(e) => {
          if (isInlineUpload) return;
          e.preventDefault();
          showContextMenu(contextMenuItems());
        }}
      >
        {/* Inline rename popover */}
        <InlineRename
          open={isRenaming}
          // For files, show baseName (without extension); for folders/pages, show full name
          title={isFolder || isPage ? name : baseName}
          onCancel={handleRenameCancel}
          onOpenChange={setIsRenaming}
          onSave={handleRenameSave}
        />
        <div
          className={cx('checkbox', styles.checkbox)}
          onPointerDown={stopPropagation}
          onClick={(e) => {
            e.stopPropagation();
            if (isInlineUpload) return;
            onSelectedChange(id, !selected);
          }}
        >
          <Checkbox checked={selected} disabled={isInlineUpload} />
        </div>

        {!isInlineUpload && (
          <div
            className={cx('dropdown', styles.dropdown)}
            onClick={stopPropagation}
            onPointerDown={stopPropagation}
          >
            <DropdownMenu items={menuItems} />
          </div>
        )}

        {isInlineUpload && uploadStatusKey && (
          <div className={styles.uploadBadge}>
            <Text fontSize={12} type={uploadStatusType}>
              {t(uploadStatusKey, { ns: 'file' })}
            </Text>
          </div>
        )}

        <div
          className={cx(
            styles.content,
            !isImage && !isMarkdown && !isPage && styles.contentWithPadding,
          )}
          onClick={isInlineUpload ? undefined : handleItemClick}
        >
          {(() => {
            switch (true) {
              case isImage && !!url: {
                return (
                  <ImageFileItem
                    chunkCount={chunkCount ?? undefined}
                    chunkingError={chunkingError}
                    chunkingStatus={chunkingStatus ?? undefined}
                    embeddingError={embeddingError}
                    embeddingStatus={embeddingStatus ?? undefined}
                    fileType={fileType}
                    finishEmbedding={finishEmbedding}
                    id={id}
                    isInView={isInView}
                    name={name}
                    size={size}
                    url={url}
                  />
                );
              }
              case isPage: {
                return (
                  <NoteFileItem
                    chunkCount={chunkCount ?? undefined}
                    chunkingError={chunkingError}
                    chunkingStatus={chunkingStatus ?? undefined}
                    embeddingError={embeddingError}
                    embeddingStatus={embeddingStatus ?? undefined}
                    fileType={fileType}
                    finishEmbedding={finishEmbedding}
                    id={id}
                    isLoadingMarkdown={isLoadingMarkdown}
                    markdownContent={markdownContent}
                    metadata={metadata}
                    name={name}
                  />
                );
              }
              case isMarkdown: {
                return (
                  <MarkdownFileItem
                    chunkCount={chunkCount ?? undefined}
                    chunkingError={chunkingError}
                    chunkingStatus={chunkingStatus ?? undefined}
                    embeddingError={embeddingError}
                    embeddingStatus={embeddingStatus ?? undefined}
                    fileType={fileType}
                    finishEmbedding={finishEmbedding}
                    id={id}
                    isLoadingMarkdown={isLoadingMarkdown}
                    markdownContent={markdownContent}
                    name={name}
                    size={size}
                  />
                );
              }
              default: {
                return (
                  <DefaultFileItem
                    chunkCount={chunkCount ?? undefined}
                    chunkingError={chunkingError}
                    chunkingStatus={chunkingStatus ?? undefined}
                    embeddingError={embeddingError}
                    embeddingStatus={embeddingStatus ?? undefined}
                    fileType={fileType}
                    finishEmbedding={finishEmbedding}
                    id={id}
                    name={name}
                    size={size}
                  />
                );
              }
            }
          })()}
        </div>
        {assetBadges.length > 0 && (
          <div className={styles.governanceBadges}>
            {assetBadges.map((badge) => (
              <Tag
                color={badge.color}
                key={badge.key}
                size={'small'}
                title={badge.title}
                variant={badge.variant}
              >
                {badge.label}
              </Tag>
            ))}
          </div>
        )}
        {governanceActivity && (
          <div className={styles.governanceBadges} style={{ paddingTop: 0 }}>
            <Text ellipsis fontSize={12} title={governanceActivity.title} type={'secondary'}>
              {governanceActivity.label}
            </Text>
          </div>
        )}
      </div>
    );
  },
);

export default MasonryFileItem;
