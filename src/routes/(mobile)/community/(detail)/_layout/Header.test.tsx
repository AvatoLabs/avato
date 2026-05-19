/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Header, { getCommunityDetailBackPath } from './Header';

const { mockNavigate, mockPathname } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockPathname: vi.fn(() => '/community/model/lobe-chat'),
}));

vi.mock('@lobehub/ui/mobile', () => ({
  ChatHeader: ({ onBackClick }: { onBackClick: () => void }) => (
    <button type="button" onClick={onBackClick}>
      back
    </button>
  ),
}));

vi.mock('@/styles/mobileHeader', () => ({
  mobileHeaderSticky: {},
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname() }),
  useNavigate: () => mockNavigate,
}));

describe('mobile community detail header', () => {
  it.each([
    ['/community/agent/my-agent', '/community/agent'],
    ['/community/model/gpt-4', '/community/model'],
    ['/community/provider/openai', '/community/provider'],
    ['/community/mcp/fetch', '/community/mcp'],
    ['/community/plugin/search', '/community/plugin'],
    ['/community/skill/writer', '/community/skill'],
    ['/community/group_agent/team', '/community/agent'],
    ['/community/user/arthur', '/community'],
  ])('resolves %s back to %s', (pathname, expected) => {
    expect(getCommunityDetailBackPath(pathname)).toBe(expected);
  });

  it('navigates back to the matching community list page', () => {
    mockNavigate.mockClear();
    mockPathname.mockReturnValue('/community/provider/openai');

    render(<Header />);

    fireEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(mockNavigate).toHaveBeenCalledWith('/community/provider');
  });
});
