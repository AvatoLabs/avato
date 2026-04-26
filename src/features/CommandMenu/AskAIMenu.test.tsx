/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AskAIMenu from './AskAIMenu';

const mockCloseCommandMenu = vi.hoisted(() => vi.fn());
const mockHandleAskLobeAI = vi.hoisted(() => vi.fn());
const mockHandleAIPainting = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const mockSendAsAgent = vi.hoisted(() => vi.fn());
const mockSendAsGroup = vi.hoisted(() => vi.fn());

vi.mock('@lobechat/const', () => ({
  DEFAULT_AVATAR: 'default-avatar',
  DEFAULT_INBOX_AVATAR: 'inbox-avatar',
  normalizeBuiltinAvatar: (value: string) => value,
}));

vi.mock('@lobehub/ui', () => ({
  Avatar: () => null,
}));

vi.mock('cmdk', () => ({
  Command: {
    Group: ({ children, heading }: any) => (
      <section>
        {heading ? <h2>{heading}</h2> : null}
        {children}
      </section>
    ),
    Item: ({ children, onSelect, value }: any) => (
      <button aria-label={value} type="button" onClick={onSelect}>
        {children}
      </button>
    ),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) =>
      (
        {
          'agentBuilder.title': 'Agent Builder',
          'cmdk.aiPainting': 'AI Painting',
          'cmdk.askAIHeading': `Ask ${options?.query ?? ''}`,
          'cmdk.askAIHeadingEmpty': 'Ask AI',
          'cmdk.search.agent': 'Agent',
          'defaultAgent': 'Default Agent',
          'starter.createGroup': 'Create Group',
        } as Record<string, string>
      )[key] || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/config/entryIcons', () => ({
  ACTION_ENTRY_ICONS: {
    createAgent: () => null,
    createGroup: () => null,
  },
  APP_ENTRY_ICONS: {
    image: () => null,
  },
}));

vi.mock('@/store/home/selectors', () => ({
  homeAgentListSelectors: {
    allAgents: (state: any) => state.allAgents,
  },
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: Object.assign(
    (selector: (state: any) => unknown) =>
      selector({
        allAgents: [],
        sendAsAgent: mockSendAsAgent,
        sendAsGroup: mockSendAsGroup,
      }),
    {
      getState: () => ({
        sendAsAgent: mockSendAsAgent,
        sendAsGroup: mockSendAsGroup,
      }),
    },
  ),
}));

vi.mock('./CommandMenuContext', () => ({
  useCommandMenuContext: () => ({
    search: 'build me an agent',
  }),
}));

vi.mock('./components', () => ({
  CommandItem: ({ onSelect, title, value }: any) => (
    <button aria-label={value} type="button" onClick={onSelect}>
      {title}
    </button>
  ),
}));

vi.mock('./styles', () => ({
  styles: {
    icon: 'icon',
    itemContent: 'itemContent',
    itemLabel: 'itemLabel',
  },
}));

vi.mock('./useCommandMenu', () => ({
  useCommandMenu: () => ({
    closeCommandMenu: mockCloseCommandMenu,
    handleAIPainting: mockHandleAIPainting,
    handleAskLobeAI: mockHandleAskLobeAI,
  }),
}));

describe('AskAIMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('catches agent builder creation errors instead of leaking unhandled rejections', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSendAsAgent.mockRejectedValueOnce(new Error('creation failed'));

    render(<AskAIMenu />);

    fireEvent.click(screen.getByRole('button', { name: 'agent-builder' }));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        '[AskAIMenu] Failed to open agent builder:',
        expect.any(Error),
      );
    });

    expect(mockCloseCommandMenu).toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
