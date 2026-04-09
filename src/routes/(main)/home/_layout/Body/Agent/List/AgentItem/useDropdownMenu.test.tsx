/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentDropdownMenu } from './useDropdownMenu';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));
const mockRemoveAgent = vi.hoisted(() => vi.fn());

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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/EditingPopover/store', () => ({
  openEditingPopover: vi.fn(),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      openAgentInNewWindow: vi.fn(),
    }),
}));

vi.mock('@/store/home/selectors', () => ({
  homeAgentListSelectors: {
    agentGroups: () => [],
  },
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      duplicateAgent: vi.fn(),
      pinAgent: vi.fn(),
      removeAgent: mockRemoveAgent,
      updateAgentGroup: vi.fn(),
    }),
}));

describe('useAgentDropdownMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting an agent fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveAgent.mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAgentDropdownMenu({
        anchor: null,
        group: undefined,
        id: 'agent-1',
        openCreateGroupModal: vi.fn(),
        pinned: false,
        title: 'Ops Agent',
      }),
    );

    const items = result.current();
    const deleteItem = items.find((item: any) => item?.key === 'delete') as any;
    deleteItem.onClick({ domEvent: { stopPropagation: vi.fn() } });

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('confirmRemoveSessionError');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete agent:', error);

    consoleErrorSpy.mockRestore();
  });
});
