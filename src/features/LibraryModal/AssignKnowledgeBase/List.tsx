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
import { type ChangeEvent, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import KnowledgeIcon from '@/components/KnowledgeIcon';
import { buildResourceLibraryPath, buildResourceRootPath } from '@/features/ResourceSpaces';
import { useClientDataSWR } from '@/libs/swr';
import { fileService } from '@/services/file';
import { agentSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { useKnowledgeBaseStore } from '@/store/library';
import { useSessionStore } from '@/store/session/store';
import { type FileListItem, type PaginatedFileList, type QueryFileListParams } from '@/types/files';
import { KnowledgeType } from '@/types/knowledgeBase';

import { type LibraryModalScope } from './types';

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
    padding: 16px;
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
  intro: css`
    padding-block: 6px 12px;
    padding-inline: 16px;
    border-block-end: 1px solid ${cssVar.colorBorderSecondary};
    background: ${cssVar.colorFillQuaternary};
  `,
  itemRow: css`
    cursor: pointer;

    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG}px;

    background: ${cssVar.colorBgContainer};

    transition:
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      border-color: ${cssVar.colorPrimaryBorder};
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
  `,
  locationBar: css`
    min-height: 32px;
  `,
  metaTag: css`
    margin: 0 !important;
  `,
  panelTitle: css`
    font-size: 12px;
    font-weight: 600;
    color: ${cssVar.colorTextTertiary};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  `,
  sourceItem: css`
    cursor: pointer;

    padding-block: 10px;
    padding-inline: 12px;
    border: 1px solid transparent;
    border-radius: ${cssVar.borderRadiusLG}px;

    transition:
      border-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut},
      background-color ${cssVar.motionDurationFast} ${cssVar.motionEaseOut};

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }
  `,
  sourceItemActive: css`
    border-color: ${cssVar.colorPrimaryBorder};
    background: ${cssVar.colorFillTertiary};
    box-shadow: inset 0 0 0 1px ${cssVar.colorPrimaryBorder};
  `,
  sourceSecondary: css`
    font-size: 12px;
    line-height: 1.4;
    color: ${cssVar.colorTextDescription};
  `,
  sourceSidebar: css`
    overflow-y: auto;

    width: 260px;
    min-width: 260px;
    padding: 16px;
    border-inline-end: 1px solid ${cssVar.colorBorderSecondary};

    background: ${cssVar.colorFillQuaternary};
  `,
  sourceTitle: css`
    font-size: 13px;
    font-weight: 600;
  `,
  summaryText: css`
    font-size: 12px;
    line-height: 1.5;
    color: ${cssVar.colorTextDescription};
  `,
  titleRow: css`
    min-height: 32px;
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
  type: 'all-files' | 'knowledge-base';
}

interface FileEntryRowProps {
  attached: boolean;
  item: FileListItem;
  loading: boolean;
  onOpenFolder: (item: FileListItem) => void;
  onToggleFile: (item: FileListItem, attached: boolean) => Promise<void>;
  scope: LibraryModalScope;
}

const FileEntryRow = memo<FileEntryRowProps>(
  ({ attached, item, loading, onOpenFolder, onToggleFile, scope }) => {
    const { t } = useTranslation('chat');
    const isFolder = item.fileType === 'custom/folder';
    const browseLabel = t(
      scope === 'conversation'
        ? 'conversationFiles.library.action.browse'
        : 'knowledgeBase.library.action.browse',
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
            <KnowledgeIcon
              fileType={item.fileType}
              name={item.name}
              size={{ file: 28, repo: 28 }}
              type={KnowledgeType.File}
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
                      ? 'conversationFiles.library.subLibrary'
                      : 'knowledgeBase.library.subLibrary',
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
            className={styles.actionButton}
            icon={attached ? <Icon icon={CheckIcon} /> : undefined}
            loading={loading}
            size={'small'}
            type={attached ? 'default' : 'primary'}
            onClick={(e) => {
              e.stopPropagation();
              void onToggleFile(item, attached);
            }}
          >
            {attached
              ? t(
                  scope === 'conversation'
                    ? 'conversationFiles.library.action.added'
                    : 'knowledgeBase.library.action.added',
                )
              : t(
                  scope === 'conversation'
                    ? 'conversationFiles.library.action.add'
                    : 'knowledgeBase.library.action.add',
                )}
          </Button>
        )}
      </Flexbox>
    );
  },
);

FileEntryRow.displayName = 'FileEntryRow';

export const List = memo<{ scope: LibraryModalScope }>(({ scope }) => {
  const { t } = useTranslation(['chat', 'file']);
  const isConversationScope = scope === 'conversation';
  const activeGroupId = useChatStore((s) => s.activeGroupId);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const conversationFileContext = activeGroupId
    ? { groupId: activeGroupId }
    : { agentId: activeAgentId };

  const agentFiles = useAgentStore((s) => agentSelectors.currentAgentFiles(s));
  const agentKnowledgeBases = useAgentStore((s) => agentSelectors.currentAgentKnowledgeBases(s));
  const [
    addFilesToAgent,
    addKnowledgeBaseToAgent,
    removeFileFromAgent,
    removeKnowledgeBaseFromAgent,
  ] = useAgentStore((s) => [
    s.addFilesToAgent,
    s.addKnowledgeBaseToAgent,
    s.removeFileFromAgent,
    s.removeKnowledgeBaseFromAgent,
  ]);

  const [useFetchConversationFiles, addFilesToConversation, deleteConversationFile] =
    useSessionStore((s) => [
      s.useFetchConversationFiles,
      s.addFilesToConversation,
      s.deleteConversationFile,
    ]);

  const useFetchKnowledgeBaseList = useKnowledgeBaseStore((s) => s.useFetchKnowledgeBaseList);

  const { data: knowledgeBases = [] } = useFetchKnowledgeBaseList();
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
            ? 'conversationFiles.library.allFilesDesc'
            : 'knowledgeBase.library.allFilesDesc',
          { ns: 'chat' },
        ),
        icon: FileStack,
        id: 'all-files',
        key: 'all-files',
        name: t(
          isConversationScope
            ? 'conversationFiles.library.allFiles'
            : 'knowledgeBase.library.allFiles',
          { ns: 'chat' },
        ),
        type: 'all-files',
      },
      ...knowledgeBases.map((item) => ({
        description: item.description,
        icon: LibraryBig,
        id: item.id,
        key: `kb:${item.id}`,
        name: item.name,
        type: 'knowledge-base' as const,
      })),
    ],
    [isConversationScope, knowledgeBases, t],
  );

  const selectedSource =
    sources.find((item) => item.key === selectedSourceKey) || sources[0] || null;
  const selectedKnowledgeBase =
    selectedSource?.type === 'knowledge-base'
      ? knowledgeBases.find((item) => item.id === selectedSource.id)
      : undefined;

  useEffect(() => {
    if (!selectedSource) return;
    if (sources.some((item) => item.key === selectedSourceKey)) return;
    setSelectedSourceKey(sources[0]?.key || 'all-files');
  }, [selectedSource, selectedSourceKey, sources]);

  const currentParentId = folderStack.at(-1)?.id ?? null;

  const queryParams = useMemo<QueryFileListParams>(() => {
    const base: QueryFileListParams = {
      attachableOnly: true,
      limit: 200,
      parentId: currentParentId,
      q: searchQuery.trim() || undefined,
      showFilesInKnowledgeBase: false,
    };

    if (selectedKnowledgeBase) {
      base.knowledgeBaseId = selectedKnowledgeBase.id;
    }

    return base;
  }, [currentParentId, searchQuery, selectedKnowledgeBase]);

  const { data, error, isLoading } = useClientDataSWR<PaginatedFileList>(
    selectedSource
      ? [
          'knowledgePickerItems',
          scope,
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

  const attachedKnowledgeBaseIds = useMemo(
    () => new Set(agentKnowledgeBases.filter((item) => item.enabled).map((item) => item.id)),
    [agentKnowledgeBases],
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

  const toggleKnowledgeBase = useCallback(
    async (knowledgeBaseId: string, attached: boolean) => {
      setMutatingKey(`library:${knowledgeBaseId}`);
      try {
        if (attached) {
          await removeKnowledgeBaseFromAgent(knowledgeBaseId);
        } else {
          await addKnowledgeBaseToAgent(knowledgeBaseId);
        }
      } finally {
        setMutatingKey(null);
      }
    },
    [addKnowledgeBaseToAgent, removeKnowledgeBaseFromAgent],
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

  const openResourcePage = useCallback(() => {
    const targetPath = selectedKnowledgeBase
      ? buildResourceLibraryPath(selectedKnowledgeBase.spaceId, selectedKnowledgeBase.id)
      : buildResourceRootPath();

    window.location.href = targetPath;
  }, [selectedKnowledgeBase]);

  const attachedLibraryCount = attachedKnowledgeBaseIds.size;
  const attachedFileCount = attachedFileIds.size;
  const selectedKnowledgeBaseAttached = selectedKnowledgeBase
    ? attachedKnowledgeBaseIds.has(selectedKnowledgeBase.id)
    : false;
  const scopeBadge = t(
    isConversationScope ? 'conversationFiles.library.scope' : 'knowledgeBase.library.scope',
  );
  const scopeDesc = t(
    isConversationScope ? 'conversationFiles.library.desc' : 'knowledgeBase.library.desc',
  );
  const canAddVisibleFiles = !selectedKnowledgeBase && visibleDetachedFileIds.length > 0;
  const visibleFilesAllAttached =
    !selectedKnowledgeBase && visibleFileItems.length > 0 && visibleDetachedFileIds.length === 0;

  return (
    <Flexbox horizontal className={styles.container}>
      <Flexbox className={styles.sourceSidebar} gap={12}>
        <Text className={styles.panelTitle}>
          {t(
            isConversationScope
              ? 'conversationFiles.library.sources'
              : 'knowledgeBase.library.sources',
          )}
        </Text>

        {sources.map((source) => {
          const selected = source.key === selectedSourceKey;
          const libraryAttached =
            source.type === 'knowledge-base' ? attachedKnowledgeBaseIds.has(source.id) : false;

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
                  {source.description && (
                    <Text className={styles.sourceSecondary} ellipsis={{ rows: 2 }}>
                      {source.description}
                    </Text>
                  )}
                </Flexbox>
              </Flexbox>

              {source.type === 'knowledge-base' && libraryAttached && (
                <Tag>{t('knowledgeBase.library.action.added')}</Tag>
              )}
            </Flexbox>
          );
        })}
      </Flexbox>

      <Flexbox className={styles.content} flex={1} gap={12}>
        <Flexbox
          horizontal
          align={'center'}
          className={styles.intro}
          gap={12}
          justify={'space-between'}
        >
          <Flexbox gap={8}>
            <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
              <Tag className={styles.metaTag}>{scopeBadge}</Tag>
              {selectedKnowledgeBase && (
                <Tag className={styles.metaTag}>{selectedKnowledgeBase.name}</Tag>
              )}
            </Flexbox>
            <Text className={styles.summaryText}>{scopeDesc}</Text>
          </Flexbox>
          <Text className={styles.countText}>
            {isConversationScope
              ? t('conversationFiles.library.attachedCount', { count: attachedFileCount })
              : t('knowledgeBase.library.attachedCount', {
                  files: attachedFileCount,
                  libraries: attachedLibraryCount,
                })}
          </Text>
        </Flexbox>

        <Flexbox gap={8}>
          <Flexbox
            horizontal
            align={'center'}
            className={styles.titleRow}
            gap={12}
            justify={'space-between'}
          >
            <Flexbox horizontal align={'center'} className={styles.locationBar} gap={6}>
              {folderStack.length > 0 && (
                <ActionIcon icon={ArrowLeft} size={'small'} onClick={handleBack} />
              )}

              <Text ellipsis strong className={styles.crumbText}>
                {selectedSource?.name}
              </Text>

              {folderStack.map((folder, index) => (
                <Flexbox horizontal align={'center'} gap={6} key={folder.id}>
                  <Icon icon={ChevronRight} size={14} />
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
            </Flexbox>

            {selectedKnowledgeBase && !isConversationScope ? (
              <Button
                className={styles.actionButton}
                icon={selectedKnowledgeBaseAttached ? <Icon icon={CheckIcon} /> : undefined}
                loading={mutatingKey === `library:${selectedKnowledgeBase.id}`}
                size={'small'}
                type={selectedKnowledgeBaseAttached ? 'default' : 'primary'}
                onClick={() =>
                  void toggleKnowledgeBase(selectedKnowledgeBase.id, selectedKnowledgeBaseAttached)
                }
              >
                {selectedKnowledgeBaseAttached
                  ? t('knowledgeBase.library.action.added')
                  : t('knowledgeBase.library.action.addLibrary')}
              </Button>
            ) : (
              <Button
                className={styles.actionButton}
                icon={visibleFilesAllAttached ? <Icon icon={CheckIcon} /> : undefined}
                loading={canAddVisibleFiles ? mutatingKey === 'visible-files' : false}
                size={'small'}
                type={canAddVisibleFiles ? 'primary' : 'default'}
                onClick={() => {
                  if (canAddVisibleFiles) {
                    void addVisibleFiles();
                    return;
                  }

                  openResourcePage();
                }}
              >
                {visibleFilesAllAttached
                  ? t(
                      isConversationScope
                        ? 'conversationFiles.library.action.added'
                        : 'knowledgeBase.library.action.added',
                    )
                  : canAddVisibleFiles
                    ? t(
                        isConversationScope
                          ? 'conversationFiles.library.action.addVisible'
                          : 'knowledgeBase.library.action.addVisible',
                      )
                    : t(
                        isConversationScope
                          ? 'conversationFiles.library.action.openResources'
                          : 'knowledgeBase.library.action.openResources',
                      )}
              </Button>
            )}
          </Flexbox>

          <SearchBar
            allowClear
            value={searchQuery}
            variant={'filled'}
            placeholder={t(
              isConversationScope
                ? 'conversationFiles.library.searchPlaceholder'
                : 'knowledgeBase.library.searchPlaceholder',
            )}
            onChange={handleSearchChange}
          />
        </Flexbox>

        <Flexbox flex={1} gap={10} style={{ minHeight: 0, overflowY: 'auto' }}>
          {isLoading ? (
            <Center flex={1}>
              <Text className={styles.countText}>{t('loading', 'Loading...', { ns: 'file' })}</Text>
            </Center>
          ) : error ? (
            <Center flex={1} gap={12}>
              <Icon icon={ServerCrash} size={64} />
              <Text className={styles.emptyHint}>{t('networkError', { ns: 'file' })}</Text>
            </Center>
          ) : items.length === 0 ? (
            <Center flex={1} gap={12}>
              <Empty
                icon={selectedKnowledgeBase ? LibraryBig : FileStack}
                style={{ maxWidth: 420 }}
                description={
                  searchQuery
                    ? t('conversationFiles.library.emptySearch', { query: searchQuery })
                    : t(
                        isConversationScope
                          ? 'conversationFiles.library.empty'
                          : 'knowledgeBase.library.empty',
                      )
                }
              />
              <Button size={'small'} type={'default'} onClick={openResourcePage}>
                {t(
                  isConversationScope
                    ? 'conversationFiles.library.action.openResources'
                    : 'knowledgeBase.library.action.openResources',
                )}
              </Button>
            </Center>
          ) : (
            items.map((item) => (
              <FileEntryRow
                attached={attachedFileIds.has(item.fileId || item.id)}
                item={item}
                key={`${item.sourceType}:${item.id}`}
                loading={mutatingKey === `file:${item.fileId || item.id}`}
                scope={scope}
                onOpenFolder={handleOpenFolder}
                onToggleFile={toggleFile}
              />
            ))
          )}
        </Flexbox>
      </Flexbox>
    </Flexbox>
  );
});

List.displayName = 'KnowledgePickerList';

export default List;
