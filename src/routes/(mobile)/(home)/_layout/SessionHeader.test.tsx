/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Header from './SessionHeader';

const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
}));
const mockCreateSession = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick, title }: any) => (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('@lobehub/ui/mobile', () => ({
  ChatHeader: ({ left, right }: any) => (
    <div>
      {left}
      {right}
    </div>
  ),
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

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/components/Branding', () => ({
  ProductLogo: () => <div>logo</div>,
}));

vi.mock('@/features/User/UserAvatar', () => ({
  default: () => <div>avatar</div>,
}));

vi.mock('@/store/session', () => ({
  useSessionStore: (selector: any) =>
    selector({
      createSession: mockCreateSession,
    }),
}));

vi.mock('@/styles/mobileHeader', () => ({
  mobileHeaderSticky: {},
}));

describe('Mobile session header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when creating a session from the header fails', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateSession.mockRejectedValue(error);

    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: 'newSession' }));

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith({ content: 'createAgentFailed' });
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to create session from mobile header:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
