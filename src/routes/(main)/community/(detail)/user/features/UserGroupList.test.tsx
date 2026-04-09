/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserGroupList from './UserGroupList';

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Grid: ({ children }: any) => <div>{children}</div>,
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  Input: {
    Search: ({ onChange, placeholder, value }: any) => (
      <input
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event)}
      />
    ),
  },
  Pagination: ({ current, onChange }: any) => (
    <div>
      <span data-testid="pagination-current">{current}</span>
      <button type="button" onClick={() => onChange(2)}>
        page-2
      </button>
    </div>
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => options?.defaultValue ?? key,
  }),
}));

vi.mock('./DetailProvider', () => ({
  useUserDetailContext: () => ({
    agentGroups: [
      {
        description: 'first group desc',
        identifier: 'group-1',
        status: 'published',
        title: 'Published First Group',
      },
      {
        description: 'second group desc',
        identifier: 'group-2',
        status: 'published',
        title: 'Published Second Group',
      },
    ],
    favoriteAgentGroups: [
      {
        description: 'favorite first desc',
        identifier: 'favorite-group-1',
        status: 'published',
        title: 'Favorite First Group',
      },
      {
        description: 'favorite second desc',
        identifier: 'favorite-group-2',
        status: 'published',
        title: 'Favorite Second Group',
      },
    ],
    forkedAgentGroups: [],
    groupCount: 2,
    isOwner: true,
  }),
}));

vi.mock('./StatusFilter', () => ({
  default: ({ onChange }: any) => (
    <button type="button" onClick={() => onChange('favorite')}>
      change-filter
    </button>
  ),
}));

vi.mock('./UserGroupCard', () => ({
  default: ({ title }: any) => <div>{title}</div>,
}));

describe('UserGroupList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets pagination to page 1 when the status filter changes', async () => {
    render(<UserGroupList pageSize={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'page-2' }));

    expect(screen.getByTestId('pagination-current')).toHaveTextContent('2');
    expect(screen.getByText('Published Second Group')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'change-filter' }));

    await waitFor(() => {
      expect(screen.getByTestId('pagination-current')).toHaveTextContent('1');
    });

    expect(screen.getByText('Favorite First Group')).toBeInTheDocument();
  });
});
