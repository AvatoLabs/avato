/**
 * @vitest-environment happy-dom
 */
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SortType } from '@/types/files';

import { useExplorerItems } from './useExplorerItems';

const resourceState = vi.hoisted(() => ({
  current: {
    governanceCapabilities: undefined,
    hasResolvedData: true,
    isLoading: false,
    isValidating: false,
    items: [
      {
        createdAt: new Date('2026-04-06T08:00:00.000Z'),
        fileId: null,
        fileType: 'custom/document',
        id: 'docs_1',
        name: 'Runbook',
        sourceType: 'document',
        updatedAt: new Date('2026-04-06T08:00:00.000Z'),
        url: '',
      },
      {
        createdAt: new Date('2026-04-06T09:00:00.000Z'),
        fileId: 'file_1',
        fileType: 'text/plain',
        id: 'file_1',
        name: 'Notes.txt',
        sourceType: 'file',
        updatedAt: new Date('2026-04-06T09:00:00.000Z'),
        url: '/f/file_1',
      },
    ],
  },
}));

vi.mock('@/routes/(main)/content/features/store/selectors', () => ({
  sortFileList: (items: any[]) => items,
}));

vi.mock('@/store/file', () => ({
  fileManagerSelectors: {
    dockFileList: (state: any) => state.dockFileList,
  },
  useFileStore: (selector: any) =>
    selector({
      dockFileList: [],
    }),
}));

vi.mock('@/store/file/slices/content/hooks', () => ({
  useVisibleResources: () => resourceState.current,
}));

describe('useExplorerItems', () => {
  it('keeps canonical document entries visible in the files surface', () => {
    const { result } = renderHook(() =>
      useExplorerItems({
        enabled: true,
        params: {
          limit: 50,
          offset: 0,
          showFilesInSourceSet: true,
          spaceId: 'spc_1',
        } as any,
        sorter: 'createdAt',
        sortType: SortType.Desc,
      }),
    );

    expect(result.current.data.map((item) => item.id)).toEqual(['docs_1', 'file_1']);
  });
});
