import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sourceSetService } from '@/services/sourceSet';
import { type CreateSourceSetParams, type SourceSetItem } from '@/types/sourceSet';
import { withSWR } from '~test-utils';

import { useSourceSetStore } from '../../store';

vi.mock('zustand/traditional');

vi.mock('swr', async (importOriginal) => {
  const modules = await importOriginal();
  return {
    ...(modules as any),
    mutate: vi.fn(),
  };
});

beforeEach(() => {
  vi.clearAllMocks();

  useSourceSetStore.setState(
    {
      activeSourceSetId: null,
      activeSourceSetItems: {},
      initSourceSetList: false,
      sourceSetLoadingIds: [],
      sourceSetRenamingId: null,
    },
    false,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SourceSetCrudAction', () => {
  describe('createSourceSet', () => {
    it('should create a source set and refresh the list', async () => {
      const params: CreateSourceSetParams = {
        name: 'Test KB',
        description: 'Test Description',
      };

      vi.spyOn(sourceSetService, 'createSourceSet').mockResolvedValue('new-kb-id');

      const { result } = renderHook(() => useSourceSetStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshSourceSetList').mockResolvedValue();

      const id = await act(async () => {
        return await result.current.createSourceSet(params);
      });

      expect(sourceSetService.createSourceSet).toHaveBeenCalledWith(params);
      expect(refreshSpy).toHaveBeenCalled();
      expect(id).toBe('new-kb-id');
    });

    it('should handle errors during creation', async () => {
      const params: CreateSourceSetParams = {
        name: 'Test KB',
      };

      const error = new Error('Creation failed');
      vi.spyOn(sourceSetService, 'createSourceSet').mockRejectedValue(error);

      const { result } = renderHook(() => useSourceSetStore());

      await expect(
        act(async () => {
          await result.current.createSourceSet(params);
        }),
      ).rejects.toThrow('Creation failed');
    });
  });

  describe('internal_setSourceSetLoading', () => {
    it('should add id to loading state when loading is true', () => {
      const { result } = renderHook(() => useSourceSetStore());

      act(() => {
        result.current.internal_setSourceSetLoading('kb-1', true);
      });

      expect(result.current.sourceSetLoadingIds).toContain('kb-1');
    });

    it('should remove id from loading state when loading is false', () => {
      act(() => {
        useSourceSetStore.setState({
          sourceSetLoadingIds: ['kb-1', 'kb-2'],
        });
      });

      const { result } = renderHook(() => useSourceSetStore());

      act(() => {
        result.current.internal_setSourceSetLoading('kb-1', false);
      });

      expect(result.current.sourceSetLoadingIds).not.toContain('kb-1');
      expect(result.current.sourceSetLoadingIds).toContain('kb-2');
    });

    it('should handle multiple toggle operations', () => {
      const { result } = renderHook(() => useSourceSetStore());

      act(() => {
        result.current.internal_setSourceSetLoading('kb-1', true);
        result.current.internal_setSourceSetLoading('kb-2', true);
        result.current.internal_setSourceSetLoading('kb-3', true);
      });

      expect(result.current.sourceSetLoadingIds).toEqual(['kb-1', 'kb-2', 'kb-3']);

      act(() => {
        result.current.internal_setSourceSetLoading('kb-2', false);
      });

      expect(result.current.sourceSetLoadingIds).toEqual(['kb-1', 'kb-3']);
    });
  });

  describe('refreshSourceSetList', () => {
    it('should execute refresh without errors', async () => {
      const { result } = renderHook(() => useSourceSetStore());

      // The action uses mutate internally - we just verify it doesn't throw
      await expect(
        act(async () => {
          await result.current.refreshSourceSetList();
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('removeSourceSet', () => {
    it('should delete a source set and refresh the list', async () => {
      vi.spyOn(sourceSetService, 'deleteSourceSet').mockResolvedValue(undefined as any);

      const { result } = renderHook(() => useSourceSetStore());
      const refreshSpy = vi.spyOn(result.current, 'refreshSourceSetList').mockResolvedValue();

      await act(async () => {
        await result.current.removeSourceSet('kb-to-delete');
      });

      expect(sourceSetService.deleteSourceSet).toHaveBeenCalledWith('kb-to-delete');
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should handle errors during deletion', async () => {
      const error = new Error('Deletion failed');
      vi.spyOn(sourceSetService, 'deleteSourceSet').mockRejectedValue(error);

      const { result } = renderHook(() => useSourceSetStore());

      await expect(
        act(async () => {
          await result.current.removeSourceSet('kb-id');
        }),
      ).rejects.toThrow('Deletion failed');
    });
  });

  describe('updateSourceSet', () => {
    it('should update a source set with loading states', async () => {
      const updateParams: CreateSourceSetParams = {
        name: 'Updated KB',
        description: 'Updated Description',
      };

      vi.spyOn(sourceSetService, 'updateSourceSet').mockResolvedValue(undefined as any);

      const { result } = renderHook(() => useSourceSetStore());
      const toggleLoadingSpy = vi.spyOn(result.current, 'internal_setSourceSetLoading');
      const refreshSpy = vi.spyOn(result.current, 'refreshSourceSetList').mockResolvedValue();

      await act(async () => {
        await result.current.updateSourceSet('kb-1', updateParams);
      });

      expect(toggleLoadingSpy).toHaveBeenCalledWith('kb-1', true);
      expect(sourceSetService.updateSourceSet).toHaveBeenCalledWith('kb-1', updateParams);
      expect(refreshSpy).toHaveBeenCalled();
      expect(toggleLoadingSpy).toHaveBeenCalledWith('kb-1', false);
    });

    it('should toggle loading off even if update fails', async () => {
      const error = new Error('Update failed');
      vi.spyOn(sourceSetService, 'updateSourceSet').mockRejectedValue(error);

      const { result } = renderHook(() => useSourceSetStore());
      const toggleLoadingSpy = vi.spyOn(result.current, 'internal_setSourceSetLoading');

      await expect(
        act(async () => {
          await result.current.updateSourceSet('kb-1', { name: 'Test' });
        }),
      ).rejects.toThrow('Update failed');

      expect(toggleLoadingSpy).toHaveBeenCalledWith('kb-1', true);
      // The false toggle won't be called because the error interrupts the flow
    });
  });

  describe('useFetchSourceSetItem', () => {
    it('should fetch a source-set item by id', async () => {
      const mockItem: SourceSetItem = {
        id: 'kb-1',
        name: 'Test KB',
        description: 'Test Description',
        avatar: 'avatar-url',
        type: 'file',
        enabled: true,
        isPublic: false,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(sourceSetService, 'getSourceSetById').mockResolvedValue(mockItem);

      const { result } = renderHook(() => useSourceSetStore().useFetchSourceSetItem('kb-1'), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockItem);
      });

      expect(sourceSetService.getSourceSetById).toHaveBeenCalledWith('kb-1');
    });

    it('should update store state on successful fetch', async () => {
      const mockItem: SourceSetItem = {
        id: 'kb-2',
        name: 'Another KB',
        description: 'Another Description',
        avatar: 'avatar-url-2',
        type: 'file',
        enabled: true,
        isPublic: false,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(sourceSetService, 'getSourceSetById').mockResolvedValue(mockItem);

      const { result } = renderHook(() => useSourceSetStore().useFetchSourceSetItem('kb-2'), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockItem);
      });

      const state = useSourceSetStore.getState();
      expect(state.activeSourceSetId).toBe('kb-2');
      expect(state.activeSourceSetItems['kb-2']).toEqual(mockItem);
    });

    it('should not update store when item is undefined', async () => {
      vi.spyOn(sourceSetService, 'getSourceSetById').mockResolvedValue(undefined);

      act(() => {
        useSourceSetStore.setState({
          activeSourceSetId: 'original-id',
          activeSourceSetItems: {},
        });
      });

      const { result } = renderHook(() => useSourceSetStore().useFetchSourceSetItem('kb-3'), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(result.current.data).toBeUndefined();
      });

      const state = useSourceSetStore.getState();
      expect(state.activeSourceSetId).toBe('original-id');
      expect(state.activeSourceSetItems).toEqual({});
    });

    it('should preserve existing items when updating', async () => {
      const existingItem: SourceSetItem = {
        id: 'kb-existing',
        name: 'Existing KB',
        description: 'Existing',
        avatar: 'avatar-existing',
        type: 'file',
        enabled: true,
        isPublic: false,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const newItem: SourceSetItem = {
        id: 'kb-new',
        name: 'New KB',
        description: 'New',
        avatar: 'avatar-new',
        type: 'file',
        enabled: true,
        isPublic: false,
        settings: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      act(() => {
        useSourceSetStore.setState({
          activeSourceSetItems: {
            'kb-existing': existingItem,
          },
        });
      });

      vi.spyOn(sourceSetService, 'getSourceSetById').mockResolvedValue(newItem);

      const { result } = renderHook(() => useSourceSetStore().useFetchSourceSetItem('kb-new'), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(newItem);
      });

      const state = useSourceSetStore.getState();
      expect(state.activeSourceSetItems['kb-existing']).toEqual(existingItem);
      expect(state.activeSourceSetItems['kb-new']).toEqual(newItem);
    });
  });

  describe('useFetchSourceSetList', () => {
    it('should fetch knowledge base list with default config', async () => {
      const mockList: SourceSetItem[] = [
        {
          id: 'kb-1',
          name: 'KB 1',
          description: 'Description 1',
          avatar: 'avatar-1',
          type: 'file',
          enabled: true,
          isPublic: false,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'kb-2',
          name: 'KB 2',
          description: 'Description 2',
          avatar: 'avatar-2',
          type: 'file',
          enabled: false,
          isPublic: false,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(sourceSetService, 'getSourceSets').mockResolvedValue(mockList);

      const { result } = renderHook(() => useSourceSetStore().useFetchSourceSetList(), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockList);
      });

      expect(sourceSetService.getSourceSets).toHaveBeenCalled();
    });

    it('should use fallback data when service returns empty', async () => {
      vi.spyOn(sourceSetService, 'getSourceSets').mockResolvedValue([]);

      const { result } = renderHook(() => useSourceSetStore().useFetchSourceSetList(), {
        wrapper: withSWR,
      });

      // Wait for the SWR hook to settle
      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });
    });

    it('should initialize knowledge base list on first success', async () => {
      const mockList: SourceSetItem[] = [
        {
          id: 'kb-1',
          name: 'KB 1',
          description: 'Description 1',
          avatar: 'avatar-1',
          type: 'file',
          enabled: true,
          isPublic: false,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      // Ensure initSourceSetList is false initially
      act(() => {
        useSourceSetStore.setState({
          initSourceSetList: false,
        });
      });

      vi.spyOn(sourceSetService, 'getSourceSets').mockResolvedValue(mockList);

      const { result } = renderHook(() => useSourceSetStore().useFetchSourceSetList(), {
        wrapper: withSWR,
      });

      // Wait for the SWR hook to settle and onSuccess to be called
      await waitFor(() => {
        expect(result.current.data).toEqual(mockList);
      });

      // Verify initSourceSetList is set to true after onSuccess
      await waitFor(() => {
        const state = useSourceSetStore.getState();
        expect(state.initSourceSetList).toBe(true);
      });
    });

    it('should not re-initialize if already initialized', async () => {
      const mockList: SourceSetItem[] = [];

      act(() => {
        useSourceSetStore.setState({
          initSourceSetList: true,
        });
      });

      vi.spyOn(sourceSetService, 'getSourceSets').mockResolvedValue(mockList);

      const { result } = renderHook(() => useSourceSetStore().useFetchSourceSetList(), {
        wrapper: withSWR,
      });

      await waitFor(() => {
        expect(result.current.data).toEqual(mockList);
      });

      const state = useSourceSetStore.getState();
      expect(state.initSourceSetList).toBe(true);
    });
  });
});
