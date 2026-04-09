/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MiniWorkspaceRail from './MiniWorkspaceRail';

const mockMessage = vi.hoisted(() => ({
  error: vi.fn(),
}));
const mockCreateSession = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: mockMessage,
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    footer: 'footer',
    iconWell: 'iconWell',
    root: 'root',
    topCluster: 'topCluster',
  }),
  cssVar: {
    borderRadiusLG: 8,
    colorText: '#000',
    motionDurationFast: '0.1s',
    motionDurationMid: '0.2s',
    motionEaseOut: 'ease-out',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/config/entryIcons', () => ({
  APP_ENTRY_ICONS: {
    home: 'home',
  },
  ENTRY_ICON_STROKE: 1.5,
}));

vi.mock('@/features/NavPanel/ToggleLeftPanelButton', () => ({
  default: () => <div>toggle</div>,
}));

vi.mock('@/routes/(main)/home/_layout/Header/components/User', () => ({
  default: () => <div>user</div>,
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) => selector({ toggleCommandMenu: vi.fn() }),
}));

vi.mock('@/store/session', () => ({
  useSessionStore: (selector: any) =>
    selector({
      createSession: mockCreateSession,
    }),
}));

describe('MiniWorkspaceRail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when creating a session fails', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateSession.mockRejectedValue(error);

    render(<MiniWorkspaceRail />);

    fireEvent.click(screen.getByRole('button', { name: 'newSession' }));

    await waitFor(() => {
      expect(mockMessage.error).toHaveBeenCalledWith({ content: 'createAgentFailed' });
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to create session from mini workspace rail:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
