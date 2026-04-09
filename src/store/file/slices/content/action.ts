import debug from 'debug';
import i18n from 'i18next';
import { createElement } from 'react';

import { notification } from '@/components/AntdStaticMethods';
import { contentService } from '@/services/content';
import { type StoreSetter } from '@/store/types';
import { getCanonicalContentKind } from '@/types/content';
import {
  type ContentItem,
  type CreateContentParams,
  type DeleteContentOptions,
  type UpdateContentParams,
} from '@/types/content';

import { type FileStore } from '../../store';
import { type ResourceState } from './initialState';
import { initialResourceState } from './initialState';
import { ResourceSyncEngine } from './syncEngine';

const log = debug('resource-manager:action');

let syncEngineInstance: ResourceSyncEngine | null = null;

type Setter = StoreSetter<FileStore>;

const getCanonicalContentSourceType = (
  item: Pick<ContentItem, 'id' | 'sourceType'> | undefined,
): 'file' | 'document' => {
  if (!item) return 'file';

  return getCanonicalContentKind(item);
};

export const createResourceSlice = (set: Setter, get: () => FileStore, _api?: unknown) => ({
  ...initialResourceState,
  ...new ResourceActionImpl(set, get, _api),
});

export class ResourceActionImpl {
  readonly #get: () => FileStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => FileStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  #syncDeletedDocumentsToPageStore = async (documentIds: string[]) => {
    if (documentIds.length === 0) return;

    const idsSet = new Set(documentIds);
    const [{ usePageStore }, { removePageDocumentsFromCache }] = await Promise.all([
      import('@/store/docs/store'),
      import('@/store/docs/slices/list/action'),
    ]);

    usePageStore.setState(
      (state) => ({
        documents: state.documents?.filter((document) => !idsSet.has(document.id)),
        selectedPageId:
          state.selectedPageId && idsSet.has(state.selectedPageId) ? null : state.selectedPageId,
      }),
      false,
    );

    await removePageDocumentsFromCache(documentIds);
  };

  #getSyncEngine = () => {
    if (!syncEngineInstance) {
      syncEngineInstance = new ResourceSyncEngine(
        () => {
          const state = this.#get();
          return {
            resourceList: state.resourceList || [],
            resourceMap: state.resourceMap || new Map(),
            syncQueue: state.syncQueue || [],
            syncingIds: state.syncingIds || new Set(),
          };
        },
        (partial) => {
          this.#set(partial as any, false, 'syncEngine/update');
        },
      );
    }
    return syncEngineInstance;
  };

  /**
   * Clear all resources and reset state
   */
  clearResources = (): void => {
    this.#set(
      {
        hasMore: false,
        offset: 0,
        queryParams: undefined,
        resourceList: [],
        resourceMap: new Map(),
        syncQueue: [],
        total: 0,
      },
      false,
      'clearResources',
    );
  };

  /**
   * Create a new resource with optimistic update
   * Returns temp ID for immediate UI feedback
   */
  createContentItem = async (params: CreateContentParams): Promise<string> => {
    const tempId = `temp-content-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // 1. Create optimistic resource
    const optimisticResource: ContentItem = {
      _optimistic: { isPending: true, retryCount: 0 },
      createdAt: new Date(),
      fileType: params.fileType,
      id: tempId,
      sourceSetId: params.sourceSetId,
      name: 'title' in params ? params.title : params.name,
      parentId: params.parentId,
      size: 'size' in params ? params.size : 0,
      sourceType: params.sourceType,
      updatedAt: new Date(),
      ...(params.sourceType === 'file'
        ? {
            url: 'storageKey' in params ? params.storageKey : '',
          }
        : {
            content: 'content' in params ? params.content : '',
            editorData: 'editorData' in params ? params.editorData : {},
            slug: 'slug' in params ? params.slug : undefined,
            title: 'title' in params ? params.title : 'Untitled',
          }),
      metadata: params.metadata,
    };

    // 2. Update store immediately (UI instant feedback)
    const { resourceMap, resourceList } = this.#get();
    const newMap = new Map(resourceMap);
    newMap.set(tempId, optimisticResource);

    this.#set(
      {
        resourceList: [optimisticResource, ...resourceList],
        resourceMap: newMap,
      },
      false,
      'createContentItem/optimistic',
    );

    // 3. Enqueue sync (background)
    const syncEngine = this.#getSyncEngine();
    syncEngine.enqueue({
      id: `sync-${tempId}`,
      payload: params,
      resourceId: tempId,
      retryCount: 0,
      timestamp: new Date(),
      type: 'create',
    });

    return tempId;
  };

  /**
   * Create a new resource and wait for sync to complete
   * Returns real ID from server (useful for auto-rename after creation)
   */
  createContentItemAndSync = async (params: CreateContentParams): Promise<string> => {
    const tempId = `temp-content-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // 1. Create optimistic resource
    const optimisticResource: ContentItem = {
      _optimistic: { isPending: true, retryCount: 0 },
      createdAt: new Date(),
      fileType: params.fileType,
      id: tempId,
      sourceSetId: params.sourceSetId,
      name: 'title' in params ? params.title : params.name,
      parentId: params.parentId,
      size: 'size' in params ? params.size : 0,
      sourceType: params.sourceType,
      updatedAt: new Date(),
      ...(params.sourceType === 'file'
        ? {
            url: 'storageKey' in params ? params.storageKey : '',
          }
        : {
            content: 'content' in params ? params.content : '',
            editorData: 'editorData' in params ? params.editorData : {},
            slug: 'slug' in params ? params.slug : undefined,
            title: 'title' in params ? params.title : 'Untitled',
          }),
      metadata: params.metadata,
    };

    // 2. Update store immediately (UI instant feedback)
    const { resourceMap, resourceList } = this.#get();
    const newMap = new Map(resourceMap);
    newMap.set(tempId, optimisticResource);

    this.#set(
      {
        resourceList: [optimisticResource, ...resourceList],
        resourceMap: newMap,
      },
      false,
      'createContentItemAndSync/optimistic',
    );

    // 3. Enqueue sync and wait for completion
    const syncEngine = this.#getSyncEngine();
    const realId = await syncEngine.enqueue({
      id: `sync-${tempId}`,
      payload: params,
      resourceId: tempId,
      retryCount: 0,
      timestamp: new Date(),
      type: 'create',
    });

    return (realId as string) || tempId;
  };

  /**
   * Delete a resource with optimistic update and rollback on failure
   * @param id Resource ID to delete
   * @param options Delete options (trash: true for soft delete, false for hard delete)
   */
  deleteContentItem = async (id: string, options?: DeleteContentOptions): Promise<void> => {
    const { documents, localDocumentMap, resourceList, resourceMap } = this.#get();
    const existing = resourceMap.get(id);
    if (!existing) {
      log('deleteContentItem: resource not found', id);
      return;
    }

    // Save state for rollback
    const rollbackState = {
      documents,
      localDocumentMap,
      resourceList,
      resourceMap,
    };

    const isDocument = getCanonicalContentSourceType(existing) === 'document';
    const trash = options?.trash ?? true; // Default to soft delete

    // Optimistic update
    const newMap = new Map(resourceMap);
    newMap.delete(id);

    const nextLocalDocumentMap = new Map(localDocumentMap);
    if (isDocument) {
      nextLocalDocumentMap.delete(id);
    }

    log('deleteContentItem: optimistic update', id, { isDocument, trash });

    this.#set(
      {
        documents: isDocument ? documents.filter((document) => document.id !== id) : documents,
        localDocumentMap: isDocument ? nextLocalDocumentMap : localDocumentMap,
        resourceList: resourceList.filter((item) => item.id !== id),
        resourceMap: newMap,
      },
      false,
      'deleteContentItem/optimistic',
    );

    try {
      // Execute the actual delete
      await contentService.deleteContentItem(id, trash);

      if (isDocument) {
        await this.#syncDeletedDocumentsToPageStore([id]);
      }

      log('deleteContentItem: success', id);

      // Show undo notification for soft delete
      if (trash) {
        const t = i18n.t.bind(i18n);
        const notificationKey = `undo-delete-${id}`;

        notification.success({
          btn: createElement(
            'button',
            {
              onClick: async () => {
                notification.destroy(notificationKey);
                try {
                  await contentService.restoreContentItem({
                    id,
                    sourceType: getCanonicalContentSourceType(existing),
                  });
                  await this.#get().refreshFileList();
                  notification.success({
                    description: t('actions.delete.undoSuccess', { ns: 'file' }),
                    duration: 3,
                    key: `${notificationKey}-success`,
                    message: '',
                  });
                } catch {
                  notification.error({
                    description: t('actions.delete.undoFailed', { ns: 'file' }),
                    duration: 3,
                    key: `${notificationKey}-error`,
                    message: '',
                  });
                }
              },
              style: {
                background: 'transparent',
                border: 'none',
                color: 'var(--ant-color-primary)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: 0,
              },
            },
            t('actions.delete.undo', { ns: 'file' }),
          ),
          description: t('actions.delete.undoMessage', { ns: 'file' }),
          duration: 5,
          key: notificationKey,
          message: '',
        });
      }
    } catch (error) {
      console.error('deleteContentItem: failed, rolling back', id, error);
      // Rollback on failure
      this.#set(
        {
          documents: rollbackState.documents,
          localDocumentMap: rollbackState.localDocumentMap,
          resourceList: rollbackState.resourceList,
          resourceMap: rollbackState.resourceMap,
        },
        false,
        'deleteContentItem/rollback',
      );
      throw error;
    }
  };

  /**
   * Batch delete resources with optimistic update and rollback on failure
   * @param ids Resource IDs to delete
   * @param options Delete options (trash: true for soft delete, false for hard delete)
   */
  deleteContentItems = async (ids: string[], options?: DeleteContentOptions): Promise<void> => {
    if (ids.length === 0) return;

    const { documents, localDocumentMap, resourceMap, resourceList } = this.#get();

    // Save state for rollback
    const rollbackState = {
      documents,
      localDocumentMap,
      resourceList,
      resourceMap,
    };

    // Classify resources by type
    const fileIds: string[] = [];
    const documentIds: string[] = [];

    for (const id of ids) {
      const resource = resourceMap.get(id);
      if (getCanonicalContentSourceType(resource) === 'document') {
        documentIds.push(id);
      } else {
        fileIds.push(id);
      }
    }

    const idsSet = new Set(ids);
    const documentIdsSet = new Set(documentIds);
    const trash = options?.trash ?? true; // Default to soft delete

    // Optimistic update
    const newMap = new Map(resourceMap);
    for (const id of ids) {
      newMap.delete(id);
    }

    const nextLocalDocumentMap = new Map(localDocumentMap);
    for (const id of documentIds) {
      nextLocalDocumentMap.delete(id);
    }

    log('deleteContentItems: optimistic update', ids, { documentIds, fileIds, trash });

    this.#set(
      {
        documents: documents.filter((document) => !documentIdsSet.has(document.id)),
        localDocumentMap: nextLocalDocumentMap,
        resourceList: resourceList.filter((r) => !idsSet.has(r.id)),
        resourceMap: newMap,
      },
      false,
      'deleteContentItems/optimistic',
    );

    try {
      // Execute actual delete with concurrency
      await contentService.deleteContentItems(ids, trash);

      if (documentIds.length > 0) {
        await this.#syncDeletedDocumentsToPageStore(documentIds);
      }

      log('deleteContentItems: success', ids);

      // Show undo notification for soft delete
      if (trash) {
        const t = i18n.t.bind(i18n);
        const notificationKey = `undo-delete-batch-${Date.now()}`;

        // Build items list for restore
        const itemsToRestore = ids.map((id) => {
          const resource = rollbackState.resourceMap.get(id);
          return {
            id,
            sourceType: getCanonicalContentSourceType(
              resource ?? { id, sourceType: 'file' as const },
            ),
          };
        }) as Array<{ id: string; sourceType: 'file' | 'document' }>;

        notification.success({
          btn: createElement(
            'button',
            {
              onClick: async () => {
                notification.destroy(notificationKey);
                try {
                  await contentService.restoreContentItems(itemsToRestore);
                  await this.#get().refreshFileList();
                  notification.success({
                    description: t('actions.delete.undoSuccess', { ns: 'file' }),
                    duration: 3,
                    key: `${notificationKey}-success`,
                    message: '',
                  });
                } catch {
                  notification.error({
                    description: t('actions.delete.undoFailed', { ns: 'file' }),
                    duration: 3,
                    key: `${notificationKey}-error`,
                    message: '',
                  });
                }
              },
              style: {
                background: 'transparent',
                border: 'none',
                color: 'var(--ant-color-primary)',
                cursor: 'pointer',
                fontSize: '14px',
                padding: 0,
              },
            },
            t('actions.delete.undo', { ns: 'file' }),
          ),
          description: t('actions.delete.undoMessage', { ns: 'file' }),
          duration: 5,
          key: notificationKey,
          message: '',
        });
      }
    } catch (error) {
      console.error('deleteContentItems: failed, rolling back', ids, error);
      // Rollback on failure
      this.#set(
        {
          documents: rollbackState.documents,
          localDocumentMap: rollbackState.localDocumentMap,
          resourceList: rollbackState.resourceList,
          resourceMap: rollbackState.resourceMap,
        },
        false,
        'deleteContentItems/rollback',
      );
      throw error;
    }
  };

  /**
   * Flush pending sync operations immediately
   */
  flushSync = async (): Promise<void> => {
    const syncEngine = this.#getSyncEngine();
    await syncEngine.flush();
  };

  /**
   * Load more resources (pagination)
   */
  loadMoreResources = async (): Promise<void> => {
    const { offset, queryParams, hasMore } = this.#get();
    if (!hasMore || !queryParams) return;

    this.#set({ isLoadingMore: true }, false, 'loadMoreResources/start');

    try {
      const { hasMore: nextHasMore, items } = await contentService.queryContentItems({
        ...queryParams,
        limit: 50,
        offset,
      });

      const { resourceMap, resourceList } = this.#get();
      const newMap = new Map(resourceMap);
      items.forEach((item) => newMap.set(item.id, item));

      this.#set(
        {
          hasMore: nextHasMore,
          isLoadingMore: false,
          offset: offset + items.length,
          resourceList: [...resourceList, ...items],
          resourceMap: newMap,
        },
        false,
        'loadMoreResources/success',
      );
    } catch (error) {
      this.#set({ isLoadingMore: false }, false, 'loadMoreResources/error');
      throw error;
    }
  };

  /**
   * Move a resource to a different parent folder
   */
  moveContentItem = async (id: string, parentId: string | null): Promise<void> => {
    const { resourceMap, resourceList } = this.#get();
    const existing = resourceMap.get(id);

    if (!existing) {
      // Resource not in local store - call backend directly without optimistic update
      // This can happen when isStoreActive is false and UI shows SWR cached data
      const syncEngine = this.#getSyncEngine();
      await syncEngine.enqueue({
        id: `sync-move-${id}-${Date.now()}`,
        payload: { parentId },
        resourceId: id,
        retryCount: 0,
        timestamp: new Date(),
        type: 'move',
      });
      return;
    }

    const newMap = new Map(resourceMap);
    newMap.delete(id);

    this.#set(
      {
        resourceList: resourceList.filter((item) => item.id !== id),
        resourceMap: newMap,
      },
      false,
      'moveContentItem/optimistic',
    );

    const syncEngine = this.#getSyncEngine();
    await syncEngine.enqueue({
      id: `sync-move-${id}-${Date.now()}`,
      payload: { parentId },
      resourceId: id,
      retryCount: 0,
      timestamp: new Date(),
      type: 'move',
    });
  };

  /**
   * Retry a failed sync operation
   */
  retrySync = async (resourceId: string): Promise<void> => {
    const { resourceMap } = this.#get();
    const resource = resourceMap.get(resourceId);

    if (resource?._optimistic?.error) {
      const updated: ContentItem = {
        ...resource,
        _optimistic: {
          isPending: true,
          retryCount: 0,
        },
      };

      const newMap = new Map(resourceMap);
      newMap.set(resourceId, updated);

      const { resourceList } = this.#get();
      const listIndex = resourceList.findIndex((item) => item.id === resourceId);
      const newList = [...resourceList];
      if (listIndex >= 0) {
        newList[listIndex] = updated;
      }

      this.#set(
        {
          resourceList: newList,
          resourceMap: newMap,
        },
        false,
        'retrySync',
      );

      const syncEngine = this.#getSyncEngine();
      syncEngine.enqueue({
        id: `sync-retry-${resourceId}-${Date.now()}`,
        payload: {},
        resourceId,
        retryCount: 0,
        timestamp: new Date(),
        type: 'update',
      });
    }
  };

  /**
   * Update a resource with optimistic update
   */
  updateContentItem = async (id: string, updates: UpdateContentParams): Promise<void> => {
    const { resourceMap, resourceList } = this.#get();
    const existing = resourceMap.get(id);

    if (!existing) {
      console.warn(`Resource ${id} not found for update`);
      return;
    }

    log('updateContentItem', id, existing, updates);

    const updated: ContentItem = {
      ...existing,
      ...updates,
      _optimistic: { isPending: true, retryCount: 0 },
      name: updates.name || updates.title || existing.name,
      updatedAt: new Date(),
    };

    const newMap = new Map(resourceMap);
    newMap.set(id, updated);

    const listIndex = resourceList.findIndex((item) => item.id === id);
    const newList = [...resourceList];
    if (listIndex >= 0) {
      newList[listIndex] = updated;
    }

    this.#set(
      {
        resourceList: newList,
        resourceMap: newMap,
      },
      false,
      'updateContentItem/optimistic',
    );

    const syncEngine = this.#getSyncEngine();
    syncEngine.enqueue({
      id: `sync-${id}-${Date.now()}`,
      payload: updates,
      resourceId: id,
      retryCount: 0,
      timestamp: new Date(),
      type: 'update',
    });

    log('enqueue updateContentItem', id, syncEngine);
  };
}

export type ResourceAction = Pick<ResourceActionImpl, keyof ResourceActionImpl>;
export type ResourceSlice = ResourceAction & ResourceState;
