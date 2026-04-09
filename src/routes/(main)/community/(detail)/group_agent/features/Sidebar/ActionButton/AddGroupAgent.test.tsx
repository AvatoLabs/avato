/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AddGroupAgent from './AddGroupAgent';

const mockGetGroups = vi.hoisted(() => vi.fn());
const mockCreateGroupWithMembers = vi.hoisted(() => vi.fn());
const mockLoadGroups = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const detailState = vi.hoisted(() => ({
  avatar: 'G',
  backgroundColor: '#000',
  config: { allowDM: true, openingMessage: 'hi', openingQuestions: [], revealDM: false },
  description: 'desc',
  identifier: 'group-1',
  memberAgents: [],
  tags: ['tag'],
  title: 'Group Title',
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
        confirm: mockModalConfirm,
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

vi.mock('@/services/chatGroup', () => ({
  chatGroupService: {
    createGroupWithMembers: mockCreateGroupWithMembers,
    getGroups: mockGetGroups,
  },
}));

vi.mock('@/services/discover', () => ({
  discoverService: {
    reportAgentEvent: vi.fn(),
    reportAgentInstall: vi.fn(),
  },
}));

vi.mock('@/store/agentGroup', () => ({
  useAgentGroupStore: (selector: any) =>
    selector({
      loadGroups: mockLoadGroups,
    }),
}));

vi.mock('../../DetailProvider', () => ({
  useDetailContext: () => detailState,
}));

describe('AddGroupAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    detailState.config = {
      allowDM: true,
      openingMessage: 'hi',
      openingQuestions: [],
      revealDM: false,
    };
    mockGetGroups.mockResolvedValue([]);
    mockLoadGroups.mockResolvedValue(undefined);
    mockCreateGroupWithMembers.mockResolvedValue({
      agentIds: [],
      groupId: 'group-local',
      supervisorAgentId: 'supervisor-1',
    });
  });

  it('shows an error when adding a group agent fails', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateGroupWithMembers.mockRejectedValue(error);

    render(<AddGroupAgent />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'groupAgents.addAndConverse' }));
    });

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('groupAgents.addError');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to add group agent from market:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when group config is missing', async () => {
    detailState.config = undefined as any;

    render(<AddGroupAgent />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'groupAgents.addAndConverse' }));
    });

    expect(mockMessageError).toHaveBeenCalledWith('groupAgents.noConfig');
    expect(mockCreateGroupWithMembers).not.toHaveBeenCalled();
  });

  it('stores the market identifier when importing a group agent from market', async () => {
    render(<AddGroupAgent />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'groupAgents.addAndConverse' }));
    });

    await waitFor(() => {
      expect(mockCreateGroupWithMembers).toHaveBeenCalled();
    });

    expect(mockCreateGroupWithMembers.mock.calls[0][0]).toMatchObject({
      marketIdentifier: 'group-1',
    });
  });

  it('detects duplicates by market identifier before adding again', async () => {
    mockGetGroups.mockResolvedValue([
      {
        id: 'local-group',
        marketIdentifier: 'group-1',
        title: 'Another Local Title',
      },
    ]);

    render(<AddGroupAgent />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'groupAgents.addAndConverse' }));
    });

    await waitFor(() => {
      expect(mockModalConfirm).toHaveBeenCalled();
    });

    expect(mockCreateGroupWithMembers).not.toHaveBeenCalled();
  });
});
