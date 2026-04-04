/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useTopicItemDropdownMenu } from './useDropdownMenu';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockOpenCreateSpaceMemoryCandidateModal = vi.hoisted(() => vi.fn());

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
  useSpaceMemoryCandidateTargets: () => ({
    defaultSpaceId: 'spc_team',
    isLoading: false,
    teamSpaces: [{ id: 'spc_team', kind: 'team', membershipRole: 'editor', name: 'Ops Team' }],
  }),
}));

vi.mock('@/helpers/activeWorkspaceSpace', () => ({
  getActiveWorkspaceSpaceId: () => 'spc_team',
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

    const action = result.current().find((item: any) => item?.key === 'addToSpaceMemory');

    expect(action?.label).toBe('space.memory.actions.addFromSource');

    await act(async () => {
      await action.onClick();
    });

    expect(mockOpenCreateSpaceMemoryCandidateModal).toHaveBeenCalledWith({
      defaultTitle: 'Weekly Sync',
      initialSpaceId: 'spc_team',
      sourceRefs: [{ id: 'topic_1', kind: 'topic', title: 'Weekly Sync' }],
    });
  });
});
