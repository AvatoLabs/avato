/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDropdownMenu } from './useDropdownMenu';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
}));
const mockRemoveTopic = vi.hoisted(() => vi.fn());

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

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: any) =>
    selector({
      removeTopic: mockRemoveTopic,
    }),
}));

describe('Copilot TopicSelector useDropdownMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting a topic fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockRemoveTopic.mockRejectedValue(error);

    const onClose = vi.fn();
    const { result } = renderHook(() =>
      useDropdownMenu({
        onClose,
        topicId: 'topic-1',
        topicTitle: 'Ops Topic',
      }),
    );

    const deleteItem = result.current().find((item: any) => item?.key === 'delete') as any;
    deleteItem.onClick();

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessage.error).toHaveBeenCalledWith('actions.removeError');
    expect(onClose).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete copilot topic:', error);

    consoleErrorSpy.mockRestore();
  });
});
