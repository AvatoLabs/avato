/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTopicItemDropdownMenu } from './useDropdownMenu';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockOpenCreateSpaceMemoryCandidateModal = vi.hoisted(() => vi.fn());
let mockResolvedSpaceId = 'spc_team';
interface TopicSpaceMemoryTargets {
  defaultSpaceId?: string;
  isLoading: boolean;
  teamSpaces: Array<{
    id: string;
    kind: string;
    membershipRole: string;
    name: string;
  }>;
}

const findAction = (items: any[] | undefined, key: string) =>
  items?.find(
    (item) => Boolean(item) && typeof item === 'object' && 'key' in item && item.key === key,
  );

let mockSpaceMemoryTargets: TopicSpaceMemoryTargets = {
  defaultSpaceId: 'spc_team',
  isLoading: false,
  teamSpaces: [{ id: 'spc_team', kind: 'team', membershipRole: 'editor', name: 'Ops Team' }],
};

vi.mock('@lobehub/ui', () => ({
  Icon: vi.fn(() => null),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      modal: { confirm: vi.fn() },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/const/version', () => ({
  isDesktop: false,
}));

vi.mock('@/features/Electron/titlebar/RecentlyViewed/plugins', () => ({
  pluginRegistry: { parseUrl: vi.fn() },
}));

vi.mock('@/features/ResourceSpaces/useOpenCreateSpaceMemoryCandidateModal', () => ({
  useOpenCreateSpaceMemoryCandidateModal: () => mockOpenCreateSpaceMemoryCandidateModal,
}));

vi.mock('@/features/ResourceSpaces/useSpaceMemoryCandidateTargets', () => ({
  useSpaceMemoryCandidateTargets: () => mockSpaceMemoryTargets,
}));

vi.mock('@/helpers/activeWorkspaceSpace', () => ({
  resolveWorkspaceSpaceId: () => mockResolvedSpaceId,
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) => selector({ activeAgentId: 'agt_1' }),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: any) =>
    selector({
      autoRenameTopicTitle: vi.fn(),
      duplicateTopic: vi.fn(),
      favoriteTopic: vi.fn(),
      removeTopic: vi.fn(),
    }),
}));

vi.mock('@/store/electron', () => ({
  useElectronStore: (selector: any) => selector({ addTab: vi.fn() }),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) => selector({ openTopicInNewWindow: vi.fn() }),
}));

describe('useTopicItemDropdownMenu (agent)', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockOpenCreateSpaceMemoryCandidateModal.mockReset();
    mockResolvedSpaceId = 'spc_team';
    mockSpaceMemoryTargets = {
      defaultSpaceId: 'spc_team',
      isLoading: false,
      teamSpaces: [{ id: 'spc_team', kind: 'team', membershipRole: 'editor', name: 'Ops Team' }],
    };
  });

  it('offers add-to-space-memory with a preselected target space', async () => {
    const { result } = renderHook(() =>
      useTopicItemDropdownMenu({
        fav: false,
        id: 'topic_1',
        title: 'Weekly Sync',
        toggleEditing: vi.fn(),
      }),
    );

    const action = findAction(result.current(), 'addToSpaceMemory');

    expect(action?.label).toBe('space.memory.actions.addFromSource');
    expect(action).toBeDefined();
    if (!action) return;

    await act(async () => {
      await (action.onClick as any)();
    });

    expect(mockOpenCreateSpaceMemoryCandidateModal).toHaveBeenCalledWith({
      defaultTitle: 'Weekly Sync',
      initialSpaceId: 'spc_team',
      sourceRefs: [{ id: 'topic_1', kind: 'topic', title: 'Weekly Sync' }],
    });
  });

  it('hides add-to-space-memory when no writable team space is available', () => {
    mockSpaceMemoryTargets = {
      defaultSpaceId: undefined,
      isLoading: false,
      teamSpaces: [],
    };

    const { result } = renderHook(() =>
      useTopicItemDropdownMenu({
        fav: false,
        id: 'topic_1',
        title: 'Weekly Sync',
        toggleEditing: vi.fn(),
      }),
    );

    const action = findAction(result.current(), 'addToSpaceMemory');

    expect(action).toBeUndefined();
  });

  it('uses the resolved route workspace for the preselected target space', async () => {
    mockResolvedSpaceId = 'spc_route';
    mockSpaceMemoryTargets = {
      defaultSpaceId: 'spc_route',
      isLoading: false,
      teamSpaces: [{ id: 'spc_route', kind: 'team', membershipRole: 'editor', name: 'Route Team' }],
    };

    const { result } = renderHook(() =>
      useTopicItemDropdownMenu({
        fav: false,
        id: 'topic_2',
        title: 'Route Workspace Topic',
        toggleEditing: vi.fn(),
      }),
    );

    const action = findAction(result.current(), 'addToSpaceMemory');
    expect(action).toBeDefined();
    if (!action) return;

    await act(async () => {
      await (action.onClick as any)();
    });

    expect(mockOpenCreateSpaceMemoryCandidateModal).toHaveBeenCalledWith(
      expect.objectContaining({
        initialSpaceId: 'spc_route',
      }),
    );
  });
});
