/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserAgentCard from './UserAgentCard';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockCreateAgent = vi.hoisted(() => vi.fn());
const mockRefreshAgentList = vi.hoisted(() => vi.fn());
const mockGetAgentByMarketIdentifier = vi.hoisted(() => vi.fn());
const mockGetAssistantDetail = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Avatar: () => null,
  Block: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any) =>
        item?.type === 'divider' ? null : (
          <button
            key={item.key}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              item.onClick?.(event);
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipGroup: ({ children }: any) => <div>{children}</div>,
  stopPropagation: vi.fn(),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
    }),
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    author: 'author',
    desc: 'desc',
    footer: 'footer',
    moreButton: 'moreButton',
    secondaryDesc: 'secondaryDesc',
    statTag: 'statTag',
    title: 'title',
    wrapper: 'wrapper',
  }),
  cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue ?? key,
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children }: any) => <a>{children}</a>,
  useNavigate: () => mockNavigate,
}));

vi.mock('@/components/PublishedTime', () => ({
  default: () => null,
}));

vi.mock('@/services/agent', () => ({
  agentService: {
    getAgentByMarketIdentifier: mockGetAgentByMarketIdentifier,
  },
}));

vi.mock('@/services/discover', () => ({
  discoverService: {
    getAssistantDetail: mockGetAssistantDetail,
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

vi.mock('@/utils/format', () => ({
  formatIntergerNumber: (value: number) => String(value),
}));

vi.mock('./DetailProvider', () => ({
  useUserDetailContext: () => ({
    isOwner: true,
    onStatusChange: vi.fn(),
  }),
}));

describe('UserAgentCard', () => {
  const defaultProps = {
    createdAt: '2024-01-01',
    description: 'desc',
    identifier: 'market-agent-id',
    title: 'Agent Title',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefreshAgentList.mockResolvedValue(undefined);
  });

  it('falls back to resolving the local agent by market identifier when createAgent returns no agentId', async () => {
    mockGetAgentByMarketIdentifier
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce('local-agent-id');
    mockGetAssistantDetail.mockResolvedValue({
      avatar: 'A',
      backgroundColor: '#fff',
      config: { model: 'gpt-4o', provider: 'openai' },
      description: 'imported desc',
      editorData: '{}',
      tags: [],
      title: 'Imported Agent',
    });
    mockCreateAgent.mockResolvedValue({
      sessionId: 'session-1',
    });

    render(<UserAgentCard {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'setting:myAgents.actions.edit' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/agent/local-agent-id/profile');
    });

    expect(mockCreateAgent).toHaveBeenCalled();
    expect(mockMessageError).not.toHaveBeenCalled();
  });
});
