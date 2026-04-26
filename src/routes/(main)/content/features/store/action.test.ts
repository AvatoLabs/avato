import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { store } from './action';

const mockFileStore = vi.hoisted(() => ({
  approveFileAssets: vi.fn(),
  archiveFileAssets: vi.fn(),
  deleteContentItems: vi.fn(),
  parseFilesToChunks: vi.fn(),
  resourceMap: new Map(),
}));

const mockSourceSetStore = vi.hoisted(() => ({
  removeFilesFromSourceSet: vi.fn(),
  removeSourceSet: vi.fn(),
}));

vi.mock('@/features/ContentManager/components/SourceSetTree/treeState', () => ({
  clearTreeStateForSourceSet: vi.fn(),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesRootPath: (spaceId?: string) => (spaceId ? `/spaces/${spaceId}/files` : '/spaces'),
}));

vi.mock('@/store/file', () => ({
  useFileStore: {
    getState: () => mockFileStore,
  },
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: {
    getState: () => ({
      navigate: vi.fn(),
    }),
  },
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: {
    getState: () => mockSourceSetStore,
  },
}));

vi.mock('@/utils/isChunkingUnsupported', () => ({
  isChunkingUnsupported: vi.fn(() => false),
}));

describe('ContentManagerStore onActionClick', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFileStore.resourceMap = new Map();
  });

  it('should batch approve selected assets and clear selection', async () => {
    const contentStore = createStore(
      store({
        selectedFileIds: ['file-1', 'file-2'],
      }),
    );

    mockFileStore.approveFileAssets.mockResolvedValue(undefined);

    await act(async () => {
      await contentStore.getState().onActionClick('approveAssets');
    });

    expect(mockFileStore.approveFileAssets).toHaveBeenCalledWith(['file-1', 'file-2']);
    expect(contentStore.getState().selectedFileIds).toEqual([]);
  });

  it('should batch archive selected assets and clear selection', async () => {
    const contentStore = createStore(
      store({
        selectedFileIds: ['file-3', 'file-4'],
      }),
    );

    mockFileStore.archiveFileAssets.mockResolvedValue(undefined);

    await act(async () => {
      await contentStore.getState().onActionClick('archiveAssets');
    });

    expect(mockFileStore.archiveFileAssets).toHaveBeenCalledWith(['file-3', 'file-4']);
    expect(contentStore.getState().selectedFileIds).toEqual([]);
  });
});
