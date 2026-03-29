import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sourceSetService } from '@/services/sourceSet';
import * as resourceHooks from '@/store/file/slices/content/hooks';

import { useSourceSetStore as useStore } from '../../store';

vi.mock('zustand/traditional');

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SourceSetContentActions', () => {
  describe('addFilesToSourceSet', () => {
    it('should add files to a source set and refresh the file list', async () => {
      const { result } = renderHook(() => useStore());

      const sourceSetId = 'kb-1';
      const fileIds = ['file-1', 'file-2', 'file-3'];

      const addFilesSpy = vi.spyOn(sourceSetService, 'addFilesToSourceSet').mockResolvedValue([
        {
          createdAt: new Date(),
          fileId: 'file-1',
          sourceSetId: 'kb-1',
          userId: 'user-1',
        },
        {
          createdAt: new Date(),
          fileId: 'file-2',
          sourceSetId: 'kb-1',
          userId: 'user-1',
        },
        {
          createdAt: new Date(),
          fileId: 'file-3',
          sourceSetId: 'kb-1',
          userId: 'user-1',
        },
      ]);

      const revalidateResourcesSpy = vi
        .spyOn(resourceHooks, 'revalidateResources')
        .mockResolvedValue(undefined);

      await act(async () => {
        await result.current.addFilesToSourceSet(sourceSetId, fileIds);
      });

      expect(addFilesSpy).toHaveBeenCalledWith(sourceSetId, fileIds);
      expect(addFilesSpy).toHaveBeenCalledTimes(1);
      expect(revalidateResourcesSpy).toHaveBeenCalled();
      expect(revalidateResourcesSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle single file addition', async () => {
      const { result } = renderHook(() => useStore());

      const sourceSetId = 'kb-1';
      const fileIds = ['file-1'];

      const addFilesSpy = vi.spyOn(sourceSetService, 'addFilesToSourceSet').mockResolvedValue([
        {
          createdAt: new Date(),
          fileId: 'file-1',
          sourceSetId: 'kb-1',
          userId: 'user-1',
        },
      ]);

      const revalidateResourcesSpy = vi
        .spyOn(resourceHooks, 'revalidateResources')
        .mockResolvedValue(undefined);

      await act(async () => {
        await result.current.addFilesToSourceSet(sourceSetId, fileIds);
      });

      expect(addFilesSpy).toHaveBeenCalledWith(sourceSetId, fileIds);
      expect(revalidateResourcesSpy).toHaveBeenCalled();
    });

    it('should handle empty file array', async () => {
      const { result } = renderHook(() => useStore());

      const sourceSetId = 'kb-1';
      const fileIds: string[] = [];

      const addFilesSpy = vi.spyOn(sourceSetService, 'addFilesToSourceSet').mockResolvedValue([]);

      const revalidateResourcesSpy = vi
        .spyOn(resourceHooks, 'revalidateResources')
        .mockResolvedValue(undefined);

      await act(async () => {
        await result.current.addFilesToSourceSet(sourceSetId, fileIds);
      });

      expect(addFilesSpy).toHaveBeenCalledWith(sourceSetId, fileIds);
      expect(revalidateResourcesSpy).toHaveBeenCalled();
    });

    describe('error handling', () => {
      it('should propagate service errors', async () => {
        const { result } = renderHook(() => useStore());

        const sourceSetId = 'kb-1';
        const fileIds = ['file-1', 'file-2'];
        const serviceError = new Error('Failed to add files to source set');

        vi.spyOn(sourceSetService, 'addFilesToSourceSet').mockRejectedValue(serviceError);

        const revalidateResourcesSpy = vi
          .spyOn(resourceHooks, 'revalidateResources')
          .mockResolvedValue(undefined);

        await expect(async () => {
          await act(async () => {
            await result.current.addFilesToSourceSet(sourceSetId, fileIds);
          });
        }).rejects.toThrow('Failed to add files to source set');

        expect(revalidateResourcesSpy).not.toHaveBeenCalled();
      });

      it('should handle refresh file list errors', async () => {
        const { result } = renderHook(() => useStore());

        const sourceSetId = 'kb-1';
        const fileIds = ['file-1'];
        const refreshError = new Error('Failed to refresh file list');

        vi.spyOn(sourceSetService, 'addFilesToSourceSet').mockResolvedValue([
          {
            createdAt: new Date(),
            fileId: 'file-1',
            sourceSetId: 'kb-1',
            userId: 'user-1',
          },
        ]);

        vi.spyOn(resourceHooks, 'revalidateResources').mockRejectedValue(refreshError);

        await expect(async () => {
          await act(async () => {
            await result.current.addFilesToSourceSet(sourceSetId, fileIds);
          });
        }).rejects.toThrow('Failed to refresh file list');
      });
    });
  });

  describe('removeFilesFromSourceSet', () => {
    it('should remove files from a source set and refresh the file list', async () => {
      const { result } = renderHook(() => useStore());

      const sourceSetId = 'kb-1';
      const fileIds = ['file-1', 'file-2', 'file-3'];

      const removeFilesSpy = vi
        .spyOn(sourceSetService, 'removeFilesFromSourceSet')
        .mockResolvedValue({} as any);

      const revalidateResourcesSpy = vi
        .spyOn(resourceHooks, 'revalidateResources')
        .mockResolvedValue(undefined);

      await act(async () => {
        await result.current.removeFilesFromSourceSet(sourceSetId, fileIds);
      });

      expect(removeFilesSpy).toHaveBeenCalledWith(sourceSetId, fileIds);
      expect(removeFilesSpy).toHaveBeenCalledTimes(1);
      expect(revalidateResourcesSpy).toHaveBeenCalled();
      expect(revalidateResourcesSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle single file removal', async () => {
      const { result } = renderHook(() => useStore());

      const sourceSetId = 'kb-1';
      const fileIds = ['file-1'];

      const removeFilesSpy = vi
        .spyOn(sourceSetService, 'removeFilesFromSourceSet')
        .mockResolvedValue({} as any);

      const revalidateResourcesSpy = vi
        .spyOn(resourceHooks, 'revalidateResources')
        .mockResolvedValue(undefined);

      await act(async () => {
        await result.current.removeFilesFromSourceSet(sourceSetId, fileIds);
      });

      expect(removeFilesSpy).toHaveBeenCalledWith(sourceSetId, fileIds);
      expect(revalidateResourcesSpy).toHaveBeenCalled();
    });

    it('should handle empty file array', async () => {
      const { result } = renderHook(() => useStore());

      const sourceSetId = 'kb-1';
      const fileIds: string[] = [];

      const removeFilesSpy = vi
        .spyOn(sourceSetService, 'removeFilesFromSourceSet')
        .mockResolvedValue({} as any);

      const revalidateResourcesSpy = vi
        .spyOn(resourceHooks, 'revalidateResources')
        .mockResolvedValue(undefined);

      await act(async () => {
        await result.current.removeFilesFromSourceSet(sourceSetId, fileIds);
      });

      expect(removeFilesSpy).toHaveBeenCalledWith(sourceSetId, fileIds);
      expect(revalidateResourcesSpy).toHaveBeenCalled();
    });

    describe('error handling', () => {
      it('should propagate service errors', async () => {
        const { result } = renderHook(() => useStore());

        const sourceSetId = 'kb-1';
        const fileIds = ['file-1', 'file-2'];
        const serviceError = new Error('Failed to remove files from knowledge base');

        vi.spyOn(sourceSetService, 'removeFilesFromSourceSet').mockRejectedValue(serviceError);

        const revalidateResourcesSpy = vi
          .spyOn(resourceHooks, 'revalidateResources')
          .mockResolvedValue(undefined);

        await expect(async () => {
          await act(async () => {
            await result.current.removeFilesFromSourceSet(sourceSetId, fileIds);
          });
        }).rejects.toThrow('Failed to remove files from knowledge base');

        expect(revalidateResourcesSpy).not.toHaveBeenCalled();
      });

      it('should handle refresh file list errors', async () => {
        const { result } = renderHook(() => useStore());

        const sourceSetId = 'kb-1';
        const fileIds = ['file-1'];
        const refreshError = new Error('Failed to refresh file list');

        vi.spyOn(sourceSetService, 'removeFilesFromSourceSet').mockResolvedValue({} as any);

        vi.spyOn(resourceHooks, 'revalidateResources').mockRejectedValue(refreshError);

        await expect(async () => {
          await act(async () => {
            await result.current.removeFilesFromSourceSet(sourceSetId, fileIds);
          });
        }).rejects.toThrow('Failed to refresh file list');
      });
    });
  });
});
