/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AddButton from './AddButton';

const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
}));
const mockMutate = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
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

vi.mock('@/libs/swr', () => ({
  useActionSWR: () => ({
    isValidating: false,
    mutate: mockMutate,
  }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) => selector({ isMobile: true }),
}));

vi.mock('@/store/session', () => ({
  useSessionStore: (selector: any) => selector({ createSession: vi.fn() }),
}));

describe('Mobile session add button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when creating a session fails', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockMutate.mockRejectedValue(error);

    render(<AddButton groupId="group-1" />);

    fireEvent.click(screen.getByRole('button', { name: 'newAgent' }));

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith({ content: 'createAgentFailed' });
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to create session from mobile add button:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
