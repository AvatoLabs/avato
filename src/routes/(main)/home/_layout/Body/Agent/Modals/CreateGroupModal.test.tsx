/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CreateGroupModal from './CreateGroupModal';

const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
}));
const mockAddGroup = vi.hoisted(() => vi.fn());
const mockToggleExpandSessionGroup = vi.hoisted(() => vi.fn());
const mockUpdateAgentGroup = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Input: ({ onChange, placeholder, value }: any) => (
    <input
      aria-label="group-name"
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  ),
  Modal: ({ children, okButtonProps, onCancel, onOk, open, title }: any) =>
    open ? (
      <div>
        <div>{title}</div>
        {children}
        <button aria-label="cancel" type="button" onClick={onCancel}>
          cancel
        </button>
        <button aria-label="ok" data-loading={String(Boolean(okButtonProps?.loading))} type="button" onClick={onOk}>
          ok
        </button>
      </div>
    ) : null,
  stopPropagation: vi.fn(),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: mockMessage,
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      toggleExpandSessionGroup: mockToggleExpandSessionGroup,
    }),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      addGroup: mockAddGroup,
      updateAgentGroup: mockUpdateAgentGroup,
    }),
}));

describe('CreateGroupModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets loading and shows an error when creating a group fails', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockAddGroup.mockRejectedValue(error);

    render(<CreateGroupModal id="agent-1" open onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('group-name'), {
      target: { value: 'Ops' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ok' }));
    });

    expect(mockMessage.error).toHaveBeenCalledWith('sessionGroup.createGroupFailed');
    expect(screen.getByRole('button', { name: 'ok' })).toHaveAttribute('data-loading', 'false');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to create session group from modal:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
