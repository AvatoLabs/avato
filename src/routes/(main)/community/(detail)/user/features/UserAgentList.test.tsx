/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import UserAgentList from './UserAgentList';

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

vi.mock('../../../features/AssistantEmpty', () => ({
  default: () => <div>empty</div>,
}));

vi.mock('./DetailProvider', () => ({
  useUserDetailContext: () => ({
    agentCount: 3,
    agents: [
      {
        description: 'first desc',
        identifier: 'agent-1',
        status: 'published',
        title: 'Match First',
      },
      {
        description: 'second desc',
        identifier: 'agent-2',
        status: 'published',
        title: 'Match Second',
      },
      { description: 'third desc', identifier: 'agent-3', status: 'published', title: 'Other' },
    ],
    favoriteAgents: [],
    forkedAgents: [],
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

vi.mock('./UserAgentCard', () => ({
  default: ({ title }: any) => <div>{title}</div>,
}));

describe('UserAgentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resets pagination to page 1 when the search query changes', async () => {
    render(<UserAgentList pageSize={1} />);

    fireEvent.click(screen.getByRole('button', { name: 'page-2' }));

    expect(screen.getByTestId('pagination-current')).toHaveTextContent('2');
    expect(screen.getByText('Match Second')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'user.searchPlaceholder' }), {
      target: { value: 'Match' },
    });

    await waitFor(() => {
      expect(screen.getByTestId('pagination-current')).toHaveTextContent('1');
    });

    expect(screen.getByText('Match First')).toBeInTheDocument();
  });
});
