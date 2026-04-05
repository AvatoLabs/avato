/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';

import QuickActionsPanel from './QuickActionsPanel';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockSetInputActiveMode = vi.hoisted(() => vi.fn());
const mockClearInputMode = vi.hoisted(() => vi.fn());
const mockFocus = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Block: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ as, children, ...props }: any) => {
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
  Icon: () => <span>icon</span>,
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ as, children, ...props }: any) => {
    const Component = as || 'span';
    return <Component {...props}>{children}</Component>;
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    activeCard: 'activeCard',
    card: 'card',
    chip: 'chip',
    contextHint: 'contextHint',
    eyebrow: 'eyebrow',
    footer: 'footer',
    iconWrap: 'iconWrap',
    modeGrid: 'modeGrid',
    title: 'title',
    utilityAction: 'utilityAction',
    utilityFooter: 'utilityFooter',
    utilityGrid: 'utilityGrid',
    utilityIconWrap: 'utilityIconWrap',
    utilityTitle: 'utilityTitle',
  }),
  cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      ({
        'starter.createAgent': 'Create Agent',
        'starter.createGroup': 'Create Group',
        'starter.write': 'Write',
        'workspace.quickActions.hint.agent': 'Build a custom assistant from your prompt.',
        'workspace.quickActions.hint.community': 'Start from curated agents and MCP tools.',
        'workspace.quickActions.hint.documents': 'Jump into your latest docs and files.',
        'workspace.quickActions.hint.documentsInWorkspace': `Open docs in ${options?.name} and keep the workspace context.`,
        'workspace.quickActions.hint.group': 'Spin up a coordinated team for the task.',
        'workspace.quickActions.hint.write': 'Turn the prompt into a working doc draft.',
        'workspace.quickActions.hint.writeInWorkspace': `Turn the prompt into a working doc draft in ${options?.name}.`,
        'workspace.quickActions.newDoc': 'Open Documents',
        'workspace.quickActions.openCommunity': 'Browse Community',
        'workspace.quickActions.scope.inWorkspace': `Actions open in ${options?.name} first.`,
        'workspace.quickActions.scope.workspace': 'Workspace',
        'workspace.quickActions.title': 'Quick Actions',
        'workspace.status.on': 'On',
      })[key] || key,
  }),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  useSpaceName: (spaceId?: string | null) =>
    ({ 'space-route': 'Ops Workspace', 'space-hint': 'Hint Workspace' })[spaceId || ''],
}));

vi.mock('@/store/home/store', () => ({
  useHomeStore: (selector: any) =>
    selector({
      clearInputMode: mockClearInputMode,
      inputActiveMode: null,
      setInputActiveMode: mockSetInputActiveMode,
    }),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: any) =>
    selector({
      mainInputEditor: {
        focus: mockFocus,
      },
    }),
}));

describe('QuickActionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-hint');
    window.history.replaceState({}, '', '/spaces/space-route/files');
  });

  it('shows the current workspace context and opens documents in the current route space', () => {
    render(<QuickActionsPanel />);

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Actions open in Ops Workspace first.')).toBeInTheDocument();
    expect(
      screen.getByText('Open docs in Ops Workspace and keep the workspace context.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Open Documents/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/spaces/space-route/docs');
  });

  it('activates write mode and focuses the main input editor', () => {
    render(<QuickActionsPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Write/i }));

    expect(mockSetInputActiveMode).toHaveBeenCalledWith('write');
    expect(mockFocus).toHaveBeenCalled();
  });
});
