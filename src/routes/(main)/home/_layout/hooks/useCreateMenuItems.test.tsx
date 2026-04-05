/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';

import { useCreateMenuItems } from './useCreateMenuItems';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockCreateNewPage = vi.hoisted(() => vi.fn());
const mockGetPageDetailPath = vi.hoisted(() =>
  vi.fn(
    (pageId: string, _kind: string, spaceId?: string | null) => `/spaces/${spaceId}/docs/${pageId}`,
  ),
);

vi.mock('@lobehub/ui', () => ({
  Icon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: vi.fn(),
      },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string) => {
      if (ns === 'file' && key === 'pageList.untitled') return 'Untitled';
      return key;
    },
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('swr/mutation', () => ({
  default: () => ({
    isMutating: false,
    trigger: vi.fn(),
  }),
}));

vi.mock('@/components/ChatGroupWizard/templates', () => ({
  useGroupTemplates: () => [],
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) =>
    selector({
      createAgent: vi.fn(),
    }),
}));

vi.mock('@/store/agentGroup', () => ({
  useAgentGroupStore: (selector: any) =>
    selector({
      createGroup: vi.fn(),
      loadGroups: vi.fn(),
    }),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      addGroup: vi.fn(),
      refreshAgentList: vi.fn(),
      switchToGroup: vi.fn(),
    }),
}));

vi.mock('@/store/docs', () => ({
  usePageStore: (selector: any) =>
    selector({
      createNewPage: mockCreateNewPage,
    }),
}));

vi.mock('@/utils/docs', () => ({
  getPageDetailPath: mockGetPageDetailPath,
}));

describe('useCreateMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-hint');
    window.history.replaceState({}, '', '/spaces/space-route/files');
    mockCreateNewPage.mockResolvedValue('page-1');
  });

  it('creates pages in the current route workspace before falling back to the hint', async () => {
    const { result } = renderHook(() => useCreateMenuItems());

    await act(async () => {
      await result.current.createPage();
    });

    expect(mockCreateNewPage).toHaveBeenCalledWith('Untitled', { spaceId: 'space-route' });
    expect(mockGetPageDetailPath).toHaveBeenCalledWith('page-1', 'doc', 'space-route');
    expect(mockNavigate).toHaveBeenCalledWith('/spaces/space-route/docs/page-1');
  });
});
