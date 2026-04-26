/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDropdownMenu } from './useDropdownMenu';

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

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      removeAgent: mockRemoveAgent,
    }),
}));

describe('Copilot AgentSelector useDropdownMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting an agent fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveAgent.mockRejectedValue(error);

    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useDropdownMenu({
        agentId: 'agent-1',
        agentTitle: 'Ops Agent',
        isBuiltinAgent: false,
        onClose,
      }),
    );

    const deleteItem = result.current.find((item: any) => item?.key === 'delete') as any;
    deleteItem.onClick();

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('confirmRemoveSessionError');
    expect(onClose).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete copilot agent:', error);

    consoleErrorSpy.mockRestore();
  });
});
