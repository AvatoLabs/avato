/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';

import { clearTreeFolderCache, clearTreeStateForSourceSet, getTreeState } from './treeState';

const mockGetKnowledgeItems = vi.hoisted(() => vi.fn());
const mockMutate = vi.hoisted(() => vi.fn());

vi.mock('@/services/file', () => ({
  fileService: {
    getKnowledgeItems: mockGetKnowledgeItems,
  },
}));

vi.mock('@/store/file', () => ({
  useFileStore: {
    getState: () => ({
      resourceList: [],
    }),
  },
}));

vi.mock('swr', () => ({
  mutate: mockMutate,
}));

describe('clearTreeFolderCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-hint');
    window.history.replaceState({}, '', '/spaces/space-route/files');
    mockGetKnowledgeItems.mockResolvedValue({ items: [] });
    clearTreeStateForSourceSet('ss-1');
  });

  it('uses the current route workspace before the stored workspace hint', async () => {
    const state = getTreeState('ss-1');
    state.expandedFolders.add('folder-1');

    await clearTreeFolderCache('ss-1');

    expect(mockGetKnowledgeItems).toHaveBeenCalledWith({
      parentId: 'folder-1',
      showFilesInSourceSet: false,
      sourceSetId: 'ss-1',
      spaceId: 'space-route',
    });
  });
});
