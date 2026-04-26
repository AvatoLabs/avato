/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionGroupMenuItems } from './useSessionGroupMenuItems';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  destroy: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  success: vi.fn(),
}));
const mockCreateAgent = vi.hoisted(() => vi.fn());
const mockRefreshAgentList = vi.hoisted(() => vi.fn());
const mockRemoveGroup = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Icon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: mockMessage,
      modal: {
        confirm: mockModalConfirm,
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    modalRoot: 'modal-root',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ChatGroupWizard/templates', () => ({
  useGroupTemplates: () => [],
}));

vi.mock('@/features/EditingPopover/store', () => ({
  openEditingPopover: vi.fn(),
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) =>
    selector({
      createAgent: mockCreateAgent,
    }),
}));

vi.mock('@/store/agentGroup', () => ({
  useAgentGroupStore: (selector: any) =>
    selector({
      createGroup: vi.fn(),
    }),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      refreshAgentList: mockRefreshAgentList,
      removeGroup: mockRemoveGroup,
    }),
}));

describe('useSessionGroupMenuItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshAgentList.mockResolvedValue(undefined);
  });

  it('handles create-agent failures without rethrowing from the menu handler', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateAgent.mockRejectedValue(error);

    const { result } = renderHook(() => useSessionGroupMenuItems());
    const item = result.current.createAgentInGroupMenuItem('group-1') as any;

    await act(async () => {
      await item.onClick({ domEvent: { stopPropagation: vi.fn() } });
    });

    expect(mockMessage.error).toHaveBeenCalledWith({ content: 'createAgentFailed' });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to create agent in session group:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when deleting a session group fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveGroup.mockRejectedValue(error);

    const { result } = renderHook(() => useSessionGroupMenuItems());
    const item = result.current.deleteGroupMenuItem('group-1') as any;
    item.onClick({ domEvent: { stopPropagation: vi.fn() } });

    const confirmConfig = mockModalConfirm.mock.calls[0][0];

    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith({ content: 'confirmRemoveGroupError' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete session group:', error);

    consoleErrorSpy.mockRestore();
  });
});
