'use client';

import {
  ActionIcon,
  Button,
  Center,
  Empty,
  Flexbox,
  Icon,
  SearchBar,
  Tag,
  Text,
} from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import {
  ArrowLeft,
  CheckIcon,
  ChevronRight,
  FileStack,
  FolderClosed,
  LibraryBig,
  ServerCrash,
} from 'lucide-react';
import { type ChangeEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SourceIcon from '@/components/SourceIcon';
import { useSpaceName } from '@/features/ResourceSpaces';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useClientDataSWR } from '@/libs/swr';
import { fileService } from '@/services/file';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { useFileStore } from '@/store/file';
import { useSessionStore } from '@/store/session/store';
import { useSourceSetStore } from '@/store/sourceSet';
import { type FileListItem, type PaginatedFileList, type QueryFileListParams } from '@/types/files';
import { AgentSourceKind } from '@/types/sourceSet';
import { isChunkingUnsupported } from '@/utils/isChunkingUnsupported';

import { type SourceSetModalScope } from './types';

const styles = createStaticStyles(({ css, cssVar }) => ({
  actionButton: css`
    min-width: 92px;
  `,
  breadcrumbButton: css`
    padding: 0 !important;
  `,
  container: css`
    overflow: hidden;
    min-height: 560px;
    max-height: min(72vh, 640px);
    background: ${cssVar.colorBgContainer};
  `,
  content: css`
    min-width: 0;
    padding-block: 18px 20px;
    padding-inline: 20px;
  `,
  countText: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  crumbText: css`
    max-width: 180px;
  `,
  emptyHint: css`
    max-width: 360px;
    text-align: center;
  `,
  itemRow: css`
    cursor: pointer;
    padding-block: 12px;
    padding-inline: 16px;
    transition:
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:not(:last-child) {
      border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    }

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  itemSecondary: css`
    font-size: 12px;
    color: ${cssVar.colorTextDescription};
  `,
  itemTitle: css`
    font-size: 14px;
    font-weight: 500;
    line-height: 1.5;
  `,
  listBody: css`
    overflow-y: auto;
    min-height: 0;
  `,
  listSurface: css`
    overflow: hidden;

    min-height: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG}px;

    background: ${cssVar.colorBgContainer};
  `,
  locationBar: css`
    min-height: 32px;
  `,
  panelTitle: css`
    font-size: 13px;
    font-weight: 600;
    color: ${cssVar.colorTextSecondary};
  `,
  searchBar: css`
    width: 100%;
  `,
  sourceItem: css`
    cursor: pointer;

    padding-block: 10px;
    padding-inline: 12px;
    border-radius: ${cssVar.borderRadiusLG}px;

    transition:
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      background: ${cssVar.colorFillSecondary};
    }
  `,
  sourceItemActive: css`
    background: ${cssVar.colorFillSecondary};
    box-shadow: inset 0 0 0 1px ${cssVar.colorBorderSecondary};
  `,
  sourceSecondary: css`
    font-size: 12px;
    line-height: 1.4;
    color: ${cssVar.colorTextDescription};
  `,
  sourceSidebar: css`
    overflow-y: auto;

    width: 252px;
    min-width: 252px;
    padding-block: 18px 20px;
    padding-inline: 16px 12px;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorFillQuaternary};
  `,
  sourceTitle: css`
    font-size: 13px;
    font-weight: 600;
    line-height: 1.4;
  `,
  emptyActions: css`
    margin-block-start: 4px;
  `,
  toolbar: css`
    gap: 12px;
    padding-block-end: 12px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
  `,
  titleRow: css`
    min-height: 36px;
  `,
}));

interface FolderCrumb {
  id: string;
  name: string;
}

interface SourceItem {
  description?: string | null;
  icon: typeof FileStack | typeof LibraryBig;
  id: string;
  key: string;
  name: string;
  spaceId?: string | null;
  type: 'all-files' | 'source-set';
}

const SourceWorkspaceBadge = memo(
  ({ activeSpaceId, spaceId }: { activeSpaceId?: string; spaceId?: string | null }) => {
    const { t } = useTranslation('chat');
    const spaceName = useSpaceName(spaceId);

    if (!spaceId || !spaceName || spaceId === activeSpaceId) return null;

    return <Tag bordered={false}>{t('sourceSet.picker.sourceWorkspace', { name: spaceName })}</Tag>;
  },
);

SourceWorkspaceBadge.displayName = 'SourceWorkspaceBadge';

interface FileEntryRowProps {
  attached: boolean;
  item: FileListItem;
  loading: boolean;
  onOpenFolder: (item: FileListItem) => void;
  onToggleFile: (item: FileListItem, attached: boolean) => Promise<void>;
  scope: SourceSetModalScope;
}

const FileEntryRow = memo<FileEntryRowProps>(
  ({ attached, item, loading, onOpenFolder, onToggleFile, scope }) => {
    const { t } = useTranslation('chat');
    const isFolder = item.fileType === 'custom/folder';
    const browseLabel = t(
      scope === 'conversation'
        ? 'conversationFiles.picker.action.browse'
        : 'sourceSet.picker.action.browse',
    );

    const handleClick = useCallback(() => {
      if (isFolder) onOpenFolder(item);
    }, [isFolder, item, onOpenFolder]);

    return (
      <Flexbox
        horizontal
        align={'center'}
        className={styles.itemRow}
        gap={12}
        justify={'space-between'}
        onClick={handleClick}
      >
        <Flexbox horizontal align={'center'} flex={1} gap={12} style={{ minWidth: 0 }}>
          {isFolder ? (
            <Icon icon={FolderClosed} size={22} />
          ) : (
            <SourceIcon
              fileType={item.fileType}
              name={item.name}
              size={{ file: 28, repo: 28 }}
              type={AgentSourceKind.File}
            />
          )}
          <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
            <Text ellipsis className={styles.itemTitle}>
              {item.name}
            </Text>
            <Text ellipsis className={styles.itemSecondary}>
              {isFolder
                ? t(
                    scope === 'conversation'
                      ? 'conversationFiles.picker.subfolder'
                      : 'sourceSet.picker.subfolder',
                  )
                : item.fileType}
            </Text>
          </Flexbox>
        </Flexbox>

        {isFolder ? (
          <Button
            size={'small'}
            type={'text'}
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            {browseLabel}
          </Button>
        ) : (
          <Button
            className={cx(styles.actionButton)}
            icon={attached ? <Icon icon={CheckIcon} /> : undefined}
            loading={loading}
            size={'small'}
            style={{ flexShrink: 0 }}
            type={attached ? 'default' : 'primary'}
            onClick={(e) => {
              e.stopPropagation();
              void onToggleFile(item, attached);
            }}
          >
            {attached
              ? t(
                  scope === 'conversation'
                    ? 'conversationFiles.picker.action.added'
                    : 'sourceSet.picker.action.added',
                )
              : t(
                  scope === 'conversation'
                    ? 'conversationFiles.picker.action.add'
                    : 'sourceSet.picker.action.add',
                )}
          </Button>
        )}
      </Flexbox>
    );
  },
);

FileEntryRow.displayName = 'FileEntryRow';

export const List = memo<{ scope: SourceSetModalScope }>(({ scope }) => {
  const { t } = useTranslation(['chat', 'file']);
  const isConversationScope = scope === 'conversation';
  const activeWorkspaceSpaceId = resolveWorkspaceSpaceId();
  const activeWorkspaceName = useSpaceName(activeWorkspaceSpaceId);
  const activeGroupId = useChatStore((s) => s.activeGroupId);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const conversationFileContext = useMemo(
    () => (activeGroupId ? { groupId: activeGroupId } : { agentId: activeAgentId }),
    [activeAgentId, activeGroupId],
  );

  const agentFiles = useAgentStore((s) => agentSelectors.currentAgentFiles(s));
  const agentSourceSets = useAgentStore((s) => agentSelectors.currentAgentSourceSets(s));
  const [addFilesToAgent, attachSourceSetToAgent, removeFileFromAgent, detachSourceSetFromAgent] =
    useAgentStore((s) => [
      s.addFilesToAgent,
      s.attachSourceSetToAgent,
      s.removeFileFromAgent,
      s.detachSourceSetFromAgent,
    ]);

  const [useFetchConversationFiles, addFilesToConversation, deleteConversationFile] =
    useSessionStore((s) => [
      s.useFetchConversationFiles,
      s.addFilesToConversation,
      s.deleteConversationFile,
    ]);

  const useFetchSourceSetList = useSourceSetStore((s) => s.useFetchSourceSetList);
  const [refreshFileList, uploadWithProgress, parseFilesToChunks] = useFileStore((s) => [
    s.refreshFileList,
    s.uploadWithProgress,
    s.parseFilesToChunks,
  ]);

  const { data: sourceSets = [] } = useFetchSourceSetList(activeWorkspaceSpaceId);
  const { data: conversationFiles = [] } = useFetchConversationFiles(
    isConversationScope ? conversationFileContext : undefined,
  );

  const [selectedSourceKey, setSelectedSourceKey] = useState('all-files');
  const [folderStack, setFolderStack] = useState<FolderCrumb[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const sources = useMemo<SourceItem[]>(
    () => [
      {
        description: t(
          isConversationScope
            ? 'conversationFiles.picker.allFilesDesc'
            : 'sourceSet.picker.allFilesDesc',
          { ns: 'chat' },
        ),
        icon: FileStack,
        id: 'all-files',
        key: 'all-files',
        name: t(
          isConversationScope ? 'conversationFiles.picker.allFiles' : 'sourceSet.picker.allFiles',
          { ns: 'chat' },
        ),
        type: 'all-files',
      },
      ...sourceSets.map((item) => ({
        description: item.description,
        icon: LibraryBig,
        id: item.id,
        key: `source-set:${item.id}`,
        name: item.name,
        spaceId: item.spaceId,
        type: 'source-set' as const,
      })),
    ],
    [isConversationScope, sourceSets, t],
  );

  const selectedSource =
    sources.find((item) => item.key === selectedSourceKey) || sources[0] || null;
  const selectedSourceSet =
    selectedSource?.type === 'source-set'
      ? sourceSets.find((item) => item.id === selectedSource.id)
      : undefined;
  const targetSpaceId = selectedSourceSet?.spaceId ?? activeWorkspaceSpaceId;
  const targetWorkspaceName = useSpaceName(targetSpaceId);

  useEffect(() => {
    if (!selectedSource) return;
    if (sources.some((item) => item.key === selectedSourceKey)) return;
    setSelectedSourceKey(sources[0]?.key || 'all-files');
  }, [selectedSource, selectedSourceKey, sources]);

  const currentParentId = folderStack.at(-1)?.id ?? null;

  const queryParams = useMemo<QueryFileListParams>(() => {
    const base: QueryFileListParams = {
      attachableOnly: isConversationScope,
      limit: 200,
      parentId: currentParentId,
      q: searchQuery.trim() || undefined,
      showFilesInSourceSet: false,
      spaceId: targetSpaceId,
    };

    if (selectedSourceSet) {
      base.sourceSetId = selectedSourceSet.id;
    }

    return base;
  }, [currentParentId, isConversationScope, searchQuery, selectedSourceSet, targetSpaceId]);

  const {
    data,
    error,
    isLoading,
    mutate: mutateItems,
  } = useClientDataSWR<PaginatedFileList>(
    selectedSource
      ? [
          'sourceSetPickerItems',
          scope,
          targetSpaceId ?? null,
          selectedSource.key,
          currentParentId || 'root',
          searchQuery.trim(),
        ]
      : null,
    () => fileService.getKnowledgeItems(queryParams),
    {
      fallbackData: { hasMore: false, items: [] },
    },
  );

  const items = useMemo(
    () =>
      [...(data?.items || [])].sort((a, b) => {
        const aFolder = a.fileType === 'custom/folder' ? 1 : 0;
        const bFolder = b.fileType === 'custom/folder' ? 1 : 0;

        if (aFolder !== bFolder) return bFolder - aFolder;

        return a.name.localeCompare(b.name);
      }),
    [data],
  );

  const attachedFileIds = useMemo(() => {
    if (isConversationScope) {
      return new Set(conversationFiles.filter((item) => item.enabled).map((item) => item.id));
    }

    return new Set(agentFiles.filter((item) => item.enabled).map((item) => item.id));
  }, [agentFiles, conversationFiles, isConversationScope]);

  const attachedSourceSetIds = useMemo(
    () => new Set(agentSourceSets.filter((item) => item.enabled).map((item) => item.id)),
    [agentSourceSets],
  );

  const handleSourceChange = useCallback((nextKey: string) => {
    setSelectedSourceKey(nextKey);
    setFolderStack([]);
    setSearchQuery('');
  }, []);

  const handleSearchChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleOpenFolder = useCallback((item: FileListItem) => {
    setFolderStack((prev) => [...prev, { id: item.id, name: item.name }]);
  }, []);

  const handleBack = useCallback(() => {
    setFolderStack((prev) => prev.slice(0, -1));
  }, []);

  const handleCrumbClick = useCallback((index: number) => {
    setFolderStack((prev) => prev.slice(0, index + 1));
  }, []);

  const setSourceSetEnabled = useCallback(
    async (sourceSetId: string, attached: boolean) => {
      setMutatingKey(`source-set:${sourceSetId}`);
      try {
        if (attached) {
          await detachSourceSetFromAgent(sourceSetId);
        } else {
          await attachSourceSetToAgent(sourceSetId);
        }
      } finally {
        setMutatingKey(null);
      }
    },
    [attachSourceSetToAgent, detachSourceSetFromAgent],
  );

  const toggleFile = useCallback(
    async (item: FileListItem, attached: boolean) => {
      const fileId = item.fileId || item.id;
      if (!fileId) return;

      setMutatingKey(`file:${fileId}`);
      try {
        if (isConversationScope) {
          if (attached) {
            await deleteConversationFile(fileId, conversationFileContext);
          } else {
            await addFilesToConversation([fileId], conversationFileContext);
          }
        } else if (attached) {
          await removeFileFromAgent(fileId);
        } else {
          await addFilesToAgent([fileId], true);
        }
      } finally {
        setMutatingKey(null);
      }
    },
    [
      addFilesToAgent,
      addFilesToConversation,
      conversationFileContext,
      deleteConversationFile,
      isConversationScope,
      removeFileFromAgent,
    ],
  );

  const visibleFileItems = useMemo(
    () => items.filter((item) => item.fileType !== 'custom/folder'),
    [items],
  );
  const visibleDetachedFileIds = useMemo(
    () =>
      visibleFileItems
        .map((item) => item.fileId || item.id)
        .filter((id): id is string => Boolean(id) && !attachedFileIds.has(id)),
    [attachedFileIds, visibleFileItems],
  );

  const addVisibleFiles = useCallback(async () => {
    if (visibleDetachedFileIds.length === 0) return;

    setMutatingKey('visible-files');
    try {
      if (isConversationScope) {
        await addFilesToConversation(visibleDetachedFileIds, conversationFileContext);
      } else {
        await addFilesToAgent(visibleDetachedFileIds, true);
      }
    } finally {
      setMutatingKey(null);
    }
  }, [
    addFilesToAgent,
    addFilesToConversation,
    conversationFileContext,
    isConversationScope,
    visibleDetachedFileIds,
  ]);

  const selectedSourceSetAttached = selectedSourceSet
    ? attachedSourceSetIds.has(selectedSourceSet.id)
    : false;
  const canAddVisibleFiles = !selectedSourceSet && visibleDetachedFileIds.length > 0;
  const showHeaderUpload = items.length > 0 || Boolean(searchQuery);

  const openUploadDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleUploadFiles = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      e.target.value = '';

      if (files.length === 0) return;

      setMutatingKey('upload-files');
      try {
        const uploaded = await Promise.all(
          files.map((file) =>
            uploadWithProgress({
              file,
              sourceSetId: selectedSourceSet?.id,
              parentId: currentParentId ?? undefined,
              spaceId: targetSpaceId,
            }),
          ),
        );

        const uploadedFileIds = uploaded.map((item) => item?.id).filter((id): id is string => !!id);

        if (uploadedFileIds.length > 0) {
          const chunkableFileIds = uploaded.reduce<string[]>((acc, item, index) => {
            if (!item?.id) return acc;
            if (isChunkingUnsupported(files[index]?.type || '')) return acc;

            acc.push(item.id);
            return acc;
          }, []);

          if (chunkableFileIds.length > 0) {
            await parseFilesToChunks(chunkableFileIds, { skipExist: true });
          }
        }

        if (isConversationScope) {
          if (uploadedFileIds.length > 0) {
            await addFilesToConversation(uploadedFileIds, conversationFileContext);
          }
        } else if (selectedSourceSet) {
          if (!selectedSourceSetAttached) {
            await attachSourceSetToAgent(selectedSourceSet.id);
          }
        } else if (uploadedFileIds.length > 0) {
          await addFilesToAgent(uploadedFileIds, true);
        }

        await refreshFileList();
        await mutateItems();
      } finally {
        setMutatingKey(null);
      }
    },
    [
      addFilesToAgent,
      addFilesToConversation,
      attachSourceSetToAgent,
      conversationFileContext,
      currentParentId,
      isConversationScope,
      mutateItems,
      parseFilesToChunks,
      refreshFileList,
      selectedSourceSet,
      selectedSourceSetAttached,
      targetSpaceId,
      uploadWithProgress,
    ],
  );

  return (
    <Flexbox horizontal className={styles.container}>
      <Flexbox className={styles.sourceSidebar} gap={12}>
        <Flexbox gap={6}>
          <Text className={styles.panelTitle}>
            {t(
              isConversationScope ? 'conversationFiles.picker.sources' : 'sourceSet.picker.sources',
            )}
          </Text>
          {activeWorkspaceName && (
            <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
              <Tag bordered={false}>{t('sourceSet.picker.workspace', { ns: 'chat' })}</Tag>
              <Text className={styles.sourceSecondary}>
                {t('sourceSet.picker.workspaceHint', {
                  name: activeWorkspaceName,
                  ns: 'chat',
                })}
              </Text>
            </Flexbox>
          )}
        </Flexbox>

        {sources.map((source) => {
          const selected = source.key === selectedSourceKey;
          const sourceSetAttached =
            source.type === 'source-set' ? attachedSourceSetIds.has(source.id) : false;

          return (
            <Flexbox
              horizontal
              align={'center'}
              className={cx(styles.sourceItem, selected && styles.sourceItemActive)}
              gap={10}
              justify={'space-between'}
              key={source.key}
              onClick={() => handleSourceChange(source.key)}
            >
              <Flexbox horizontal align={'center'} flex={1} gap={10} style={{ minWidth: 0 }}>
                <Icon icon={source.icon} size={18} />
                <Flexbox flex={1} gap={4} style={{ minWidth: 0 }}>
                  <Text ellipsis className={styles.sourceTitle}>
                    {source.name}
                  </Text>
                  <SourceWorkspaceBadge
                    activeSpaceId={activeWorkspaceSpaceId}
                    spaceId={source.spaceId}
                  />
                  {source.description && (
                    <Text className={styles.sourceSecondary} ellipsis={{ rows: 2 }}>
                      {source.description}
                    </Text>
                  )}
                </Flexbox>
              </Flexbox>

              {source.type === 'source-set' && sourceSetAttached && (
                <Tag>{t('sourceSet.picker.action.added')}</Tag>
              )}
            </Flexbox>
          );
        })}
      </Flexbox>

      <Flexbox className={styles.content} flex={1} gap={16}>
        <Flexbox className={styles.toolbar}>
          <Flexbox
            horizontal
            align={'center'}
            className={styles.titleRow}
            gap={12}
            justify={'space-between'}
          >
            <Flexbox horizontal align={'center'} className={styles.locationBar} gap={6}>
              {folderStack.length > 0 && (
                <>
                  <ActionIcon icon={ArrowLeft} size={'small'} onClick={handleBack} />

                  {folderStack.map((folder, index) => (
                    <Flexbox horizontal align={'center'} gap={6} key={folder.id}>
                      {index > 0 && <Icon icon={ChevronRight} size={14} />}
                      <Button
                        className={styles.breadcrumbButton}
                        size={'small'}
                        type={'text'}
                        onClick={() => handleCrumbClick(index)}
                      >
                        {folder.name}
                      </Button>
                    </Flexbox>
                  ))}
                </>
              )}
              {targetWorkspaceName && targetSpaceId && targetSpaceId !== activeWorkspaceSpaceId && (
                <Tag bordered={false}>
                  {t('sourceSet.picker.sourceWorkspace', {
                    name: targetWorkspaceName,
                    ns: 'chat',
                  })}
                </Tag>
              )}
            </Flexbox>

            <Flexbox horizontal gap={8} wrap={'wrap'}>
              {showHeaderUpload && (
                <Button
                  className={styles.actionButton}
                  loading={mutatingKey === 'upload-files'}
                  size={'small'}
                  type={'default'}
                  onClick={openUploadDialog}
                >
                  {t(
                    isConversationScope
                      ? 'conversationFiles.picker.action.upload'
                      : 'sourceSet.picker.action.upload',
                  )}
                </Button>
              )}

              {selectedSourceSet && !isConversationScope ? (
                <Button
                  className={styles.actionButton}
                  icon={selectedSourceSetAttached ? <Icon icon={CheckIcon} /> : undefined}
                  loading={mutatingKey === `source-set:${selectedSourceSet.id}`}
                  size={'small'}
                  type={selectedSourceSetAttached ? 'default' : 'primary'}
                  onClick={() =>
                    void setSourceSetEnabled(selectedSourceSet.id, selectedSourceSetAttached)
                  }
                >
                  {selectedSourceSetAttached
                    ? t('sourceSet.picker.action.added')
                    : t('sourceSet.picker.action.addSourceSet')}
                </Button>
              ) : canAddVisibleFiles ? (
                <Button
                  className={styles.actionButton}
                  loading={mutatingKey === 'visible-files'}
                  size={'small'}
                  type={'primary'}
                  onClick={() => {
                    void addVisibleFiles();
                  }}
                >
                  {t(
                    isConversationScope
                      ? 'conversationFiles.picker.action.addVisible'
                      : 'sourceSet.picker.action.addVisible',
                  )}
                </Button>
              ) : null}
            </Flexbox>
          </Flexbox>

          <SearchBar
            allowClear
            className={styles.searchBar}
            value={searchQuery}
            variant={'filled'}
            placeholder={t(
              isConversationScope
                ? 'conversationFiles.picker.searchPlaceholder'
                : 'sourceSet.picker.searchPlaceholder',
            )}
            onChange={handleSearchChange}
          />
        </Flexbox>

        <Flexbox className={styles.listSurface} flex={1}>
          <input hidden multiple ref={fileInputRef} type={'file'} onChange={handleUploadFiles} />
          {isLoading ? (
            <Center flex={1} style={{ minHeight: 280 }}>
              <Text className={styles.countText}>{t('loading', 'Loading...', { ns: 'file' })}</Text>
            </Center>
          ) : error ? (
            <Center flex={1} gap={12} style={{ minHeight: 280 }}>
              <Icon icon={ServerCrash} size={64} />
              <Text className={styles.emptyHint}>{t('networkError', { ns: 'file' })}</Text>
            </Center>
          ) : items.length === 0 ? (
            <Center flex={1} gap={12} style={{ minHeight: 280 }}>
              <Empty
                icon={selectedSourceSet ? LibraryBig : FileStack}
                style={{ maxWidth: 420 }}
                description={
                  searchQuery
                    ? t('conversationFiles.picker.emptySearch', { query: searchQuery })
                    : t(
                        isConversationScope
                          ? 'conversationFiles.picker.empty'
                          : 'sourceSet.picker.empty',
                      )
                }
              />
              {!searchQuery && (
                <Flexbox horizontal className={styles.emptyActions} gap={8}>
                  <Button
                    loading={mutatingKey === 'upload-files'}
                    size={'small'}
                    type={'primary'}
                    onClick={openUploadDialog}
                  >
                    {t(
                      isConversationScope
                        ? 'conversationFiles.picker.action.upload'
                        : 'sourceSet.picker.action.upload',
                    )}
                  </Button>
                </Flexbox>
              )}
            </Center>
          ) : (
            <Flexbox className={styles.listBody} flex={1}>
              {items.map((item) => (
                <FileEntryRow
                  attached={attachedFileIds.has(item.fileId || item.id)}
                  item={item}
                  key={`${item.sourceType}:${item.id}`}
                  loading={mutatingKey === `file:${item.fileId || item.id}`}
                  scope={scope}
                  onOpenFolder={handleOpenFolder}
                  onToggleFile={toggleFile}
                />
              ))}
            </Flexbox>
          )}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

List.displayName = 'SourceSetPickerList';

export default List;
