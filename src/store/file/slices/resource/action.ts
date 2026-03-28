import debug from 'debug';

import { documentService } from '@/services/document';
import { fileService } from '@/services/file';
import { resourceService } from '@/services/resource';
import { type StoreSetter } from '@/store/types';
import {
  type CreateResourceParams,
  type DeleteResourceOptions,
  type ResourceItem,
  type UpdateResourceParams,
} from '@/types/resource';

import { type FileStore } from '../../store';
import { type ResourceState } from './initialState';
import { initialResourceState } from './initialState';
import { ResourceSyncEngine } from './syncEngine';

const log = debug('resource-manager:action');

let syncEngineInstance: ResourceSyncEngine | null = null;

type Setter = StoreSetter<FileStore>;
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
      import('@/store/page/store'),
      import('@/store/page/slices/list/action'),
    ]);

    usePageStore.setState((state) => ({
      documents: state.documents?.filter((document) => !idsSet.has(document.id)),
      selectedPageId:
        state.selectedPageId && idsSet.has(state.selectedPageId) ? null : state.selectedPageId,
    }), false);

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
  createResource = async (params: CreateResourceParams): Promise<string> => {
    const tempId = `temp-resource-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // 1. Create optimistic resource
    const optimisticResource: ResourceItem = {
      _optimistic: { isPending: true, retryCount: 0 },
      createdAt: new Date(),
      fileType: params.fileType,
      id: tempId,
      knowledgeBaseId: params.knowledgeBaseId,
      name: 'title' in params ? params.title : params.name,
      parentId: params.parentId,
      size: 'size' in params ? params.size : 0,
      sourceType: params.sourceType,
      updatedAt: new Date(),
      ...(params.sourceType === 'file'
        ? {
          url: 'url' in params ? params.url : '',
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
      'createResource/optimistic',
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
  createResourceAndSync = async (params: CreateResourceParams): Promise<string> => {
    const tempId = `temp-resource-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    // 1. Create optimistic resource
    const optimisticResource: ResourceItem = {
      _optimistic: { isPending: true, retryCount: 0 },
      createdAt: new Date(),
      fileType: params.fileType,
      id: tempId,
      knowledgeBaseId: params.knowledgeBaseId,
      name: 'title' in params ? params.title : params.name,
      parentId: params.parentId,
      size: 'size' in params ? params.size : 0,
      sourceType: params.sourceType,
      updatedAt: new Date(),
      ...(params.sourceType === 'file'
        ? {
          url: 'url' in params ? params.url : '',
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
      'createResourceAndSync/optimistic',
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
  deleteResource = async (id: string, options?: DeleteResourceOptions): Promise<void> => {
    const { documents, localDocumentMap, resourceList, resourceMap } = this.#get();
    const existing = resourceMap.get(id);
    if (!existing) {
      log('deleteResource: resource not found', id);
      return;
    }

    // Save state for rollback
    const rollbackState = {
      documents,
      localDocumentMap,
      resourceList,
      resourceMap,
    };

    const isDocument = existing.sourceType === 'document';
    const trash = options?.trash ?? true; // Default to soft delete

    // Optimistic update
    const newMap = new Map(resourceMap);
    newMap.delete(id);

    const nextLocalDocumentMap = new Map(localDocumentMap);
    if (isDocument) {
      nextLocalDocumentMap.delete(id);
    }

    log('deleteResource: optimistic update', id, { isDocument, trash });

    this.#set(
      {
        documents: isDocument ? documents.filter((document) => document.id !== id) : documents,
        localDocumentMap: isDocument ? nextLocalDocumentMap : localDocumentMap,
        resourceList: resourceList.filter((item) => item.id !== id),
        resourceMap: newMap,
      },
      false,
      'deleteResource/optimistic',
    );

    try {
      // Execute the actual delete
      await resourceService.deleteResource(id, trash);

      if (isDocument) {
        await this.#syncDeletedDocumentsToPageStore([id]);
      }

      log('deleteResource: success', id);
    } catch (error) {
      console.error('deleteResource: failed, rolling back', id, error);
      // Rollback on failure
      this.#set(
        {
          documents: rollbackState.documents,
          localDocumentMap: rollbackState.localDocumentMap,
          resourceList: rollbackState.resourceList,
          resourceMap: rollbackState.resourceMap,
        },
        false,
        'deleteResource/rollback',
      );
      throw error;
    }
  };

  /**
   * Batch delete resources with optimistic update and rollback on failure
   * @param ids Resource IDs to delete
   * @param options Delete options (trash: true for soft delete, false for hard delete)
   */
  deleteResources = async (ids: string[], options?: DeleteResourceOptions): Promise<void> => {
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
      if (resource?.sourceType === 'document') {
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

    log('deleteResources: optimistic update', ids, { documentIds, fileIds, trash });

    this.#set(
      {
        documents: documents.filter((document) => !documentIdsSet.has(document.id)),
        localDocumentMap: nextLocalDocumentMap,
        resourceList: resourceList.filter((r) => !idsSet.has(r.id)),
        resourceMap: newMap,
      },
      false,
      'deleteResources/optimistic',
    );

    try {
      // Execute actual delete with concurrency
      await resourceService.deleteResources(ids, trash);

      if (documentIds.length > 0) {
        await this.#syncDeletedDocumentsToPageStore(documentIds);
      }

      log('deleteResources: success', ids);
    } catch (error) {
      console.error('deleteResources: failed, rolling back', ids, error);
      // Rollback on failure
      this.#set(
        {
          documents: rollbackState.documents,
          localDocumentMap: rollbackState.localDocumentMap,
          resourceList: rollbackState.resourceList,
          resourceMap: rollbackState.resourceMap,
        },
        false,
        'deleteResources/rollback',
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
      const { hasMore: nextHasMore, items } = await resourceService.queryResources({
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
  moveResource = async (id: string, parentId: string | null): Promise<void> => {
    const { resourceMap, resourceList } = this.#get();
    const existing = resourceMap.get(id);

    if (!existing) {
      console.warn(`Resource ${id} not found for move`);
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
      'moveResource/optimistic',
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
      const updated: ResourceItem = {
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
  updateResource = async (id: string, updates: UpdateResourceParams): Promise<void> => {
    const { resourceMap, resourceList } = this.#get();
    const existing = resourceMap.get(id);

    if (!existing) {
      console.warn(`Resource ${id} not found for update`);
      return;
    }

    log('updateResource', id, existing, updates);

    const updated: ResourceItem = {
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
      'updateResource/optimistic',
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

    log('enqueue updateResource', id, syncEngine);
  };
}

export type ResourceAction = Pick<ResourceActionImpl, keyof ResourceActionImpl>;
export type ResourceSlice = ResourceAction & ResourceState;
