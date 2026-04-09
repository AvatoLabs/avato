/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserGroupCard from './UserGroupCard';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockGetGroups = vi.hoisted(() => vi.fn());

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

vi.mock('@/services/chatGroup', () => ({
  chatGroupService: {
    getGroups: mockGetGroups,
  },
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

describe('UserGroupCard', () => {
  const defaultProps = {
    createdAt: '2024-01-01',
    description: 'desc',
    identifier: 'market-group-id',
    memberCount: 2,
    title: 'Group Title',
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('navigates to the local group profile when editing an owned market group', async () => {
    mockGetGroups.mockResolvedValue([
      {
        id: 'local-group-id',
        marketIdentifier: 'market-group-id',
      },
    ]);

    render(<UserGroupCard {...defaultProps} />);
    mockNavigate.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'setting:myAgents.actions.edit' }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/group/local-group-id/profile');
    });
  });

  it('shows an error instead of navigating when no local group matches the market identifier', async () => {
    mockGetGroups.mockResolvedValue([
      {
        id: 'another-group',
        marketIdentifier: 'another-market-id',
      },
    ]);

    render(<UserGroupCard {...defaultProps} />);
    mockNavigate.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'setting:myAgents.actions.edit' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('setting:myAgents.errors.fetchFailed');
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
