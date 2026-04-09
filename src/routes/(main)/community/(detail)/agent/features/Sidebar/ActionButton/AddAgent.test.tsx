/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AddAgent from './AddAgent';

const mockCreateAgent = vi.hoisted(() => vi.fn());
const mockRefreshAgentList = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockCheckByMarketIdentifier = vi.hoisted(() => vi.fn());
const detailState = vi.hoisted(() => ({
  avatar: 'A',
  backgroundColor: '#000',
  config: { model: 'gpt-test' },
  description: 'desc',
  editorData: null,
  identifier: 'agent-1',
  tags: ['tag'],
  title: 'Agent Title',
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, disabled, loading, onClick }: any) => (
    <button disabled={disabled || loading} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
        success: mockMessageSuccess,
      },
      modal: {
        confirm: vi.fn(),
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    buttonGroup: 'buttonGroup',
    menuButton: 'menuButton',
    primaryButton: 'primaryButton',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/const/url', () => ({
  SESSION_CHAT_URL: (id: string) => `/chat/${id}`,
}));

vi.mock('@/services/agent', () => ({
  agentService: {
    checkByMarketIdentifier: mockCheckByMarketIdentifier,
  },
}));

vi.mock('@/services/discover', () => ({
  discoverService: {
    reportAgentEvent: vi.fn(),
    reportAgentInstall: vi.fn(),
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) =>
    selector({
      createAgent: mockCreateAgent,
    }),
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      refreshAgentList: mockRefreshAgentList,
    }),
}));

vi.mock('../../DetailProvider', () => ({
  useDetailContext: () => detailState,
}));

describe('AddAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detailState.config = { model: 'gpt-test' };
    mockCheckByMarketIdentifier.mockResolvedValue(false);
    mockRefreshAgentList.mockResolvedValue(undefined);
  });

  it('shows an error when adding an agent fails', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateAgent.mockRejectedValue(error);

    render(<AddAgent />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'assistants.addAgentAndConverse' }));
    });

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('assistants.addAgentError');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to add agent from market:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when agent config is missing', async () => {
    detailState.config = undefined as any;

    render(<AddAgent />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'assistants.addAgentAndConverse' }));
    });

    expect(mockMessageError).toHaveBeenCalledWith('assistants.noConfig');
    expect(mockCreateAgent).not.toHaveBeenCalled();
  });
});
