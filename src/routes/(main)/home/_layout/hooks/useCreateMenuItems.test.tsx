/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';

import { useCreateMenuItems } from './useCreateMenuItems';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockCreateNewPage = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockMutateAgent = vi.hoisted(() => vi.fn());
const mockMutateGroup = vi.hoisted(() => vi.fn());
const mockAddGroup = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Icon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
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
  default: (key: string) => {
    const trigger = key === 'agent.createAgent' ? mockMutateAgent : mockMutateGroup;

    return {
      isMutating: false,
      trigger,
    };
  },
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
      addGroup: mockAddGroup,
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

describe('useCreateMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-hint');
    window.history.replaceState({}, '', '/spaces/space-route/files');
    mockCreateNewPage.mockResolvedValue('page-1');
    mockMutateAgent.mockResolvedValue({ agentId: 'agent-1' });
    mockMutateGroup.mockResolvedValue('group-1');
    mockAddGroup.mockResolvedValue(undefined);
  });

  it('creates pages in the current route workspace before falling back to the hint', async () => {
    const { result } = renderHook(() => useCreateMenuItems());

    await act(async () => {
      await result.current.createPage();
    });

    expect(mockCreateNewPage).toHaveBeenCalledWith('Untitled', { spaceId: 'space-route' });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('handles agent creation failures inside the hook', async () => {
    const error = new Error('agent create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMutateAgent.mockRejectedValue(error);
    const { result } = renderHook(() => useCreateMenuItems());

    await act(async () => {
      await result.current.createAgent();
    });

    expect(mockMessageError).toHaveBeenCalledWith({ content: 'createAgentFailed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create agent:', error);

    consoleErrorSpy.mockRestore();
  });

  it('handles empty group creation failures inside the hook', async () => {
    const error = new Error('group create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMutateGroup.mockRejectedValue(error);
    const { result } = renderHook(() => useCreateMenuItems());

    await act(async () => {
      await result.current.createEmptyGroup();
    });

    expect(mockMessageError).toHaveBeenCalledWith({ content: 'createGroupFailed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create group:', error);

    consoleErrorSpy.mockRestore();
  });

  it('resets session-group loading state after addGroup fails', async () => {
    const error = new Error('session group create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAddGroup.mockRejectedValue(error);
    const { result } = renderHook(() => useCreateMenuItems());
    const menuItem = result.current.createSessionGroupMenuItem() as any;

    await act(async () => {
      await menuItem.onClick({ domEvent: { stopPropagation: vi.fn() } });
    });

    expect(mockMessageError).toHaveBeenCalledWith({ content: 'createGroupFailed' });
    expect(result.current.isCreatingSessionGroup).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create session group:', error);

    consoleErrorSpy.mockRestore();
  });
});
