/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useAgentStore } from '@/store/agent/store';

import AgentSourcesInline from './AgentSourcesInline';

const mockOpenSourceSettings = vi.hoisted(() => vi.fn());
const removeFileFromAgent = vi.hoisted(() => vi.fn());
const detachSourceSetFromAgent = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, icon: Icon, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {Icon ? <Icon /> : null}
      {children}
    </button>
  ),
  Flexbox: ({ as, children, align, gap, horizontal, wrap, ...props }: any) => {
    void align;
    void gap;
    void horizontal;
    void wrap;
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
  Tag: ({ children, closable, icon, onClick, onClose }: any) => (
    <div>
      <button type="button" onClick={onClick}>
        {icon}
        {children}
      </button>
      {closable && (
        <button aria-label={`remove-${children}`} type="button" onClick={onClose}>
          remove
        </button>
      )}
    </div>
  ),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    tag: 'tag',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'settingSources.inlineAdd': 'Add Sources',
      })[key] || key,
  }),
}));

vi.mock('@/components/SourceIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}-icon</span>,
}));

vi.mock('@/features/SourceSetModal', () => ({
  AttachSourceSetModal: ({ open, scope }: { open?: boolean; scope?: string }) => (
    <div data-testid="attach-sources-modal">{open ? `open:${scope}` : 'closed'}</div>
  ),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  useSpaceName: (spaceId?: string | null) =>
    ({ 'space-1': 'My Space', 'space-2': 'Shared Space', 'space-route': 'Route Space' })[
      spaceId || ''
    ],
}));

vi.mock('@/helpers/activeWorkspaceSpace', async () => {
  const actual = await vi.importActual('@/helpers/activeWorkspaceSpace');

  return {
    ...actual,
    resolveWorkspaceSpaceId: () => {
      const match = window.location.pathname.match(/^\/spaces\/([^/]+)/);
      return match?.[1] ?? actual.getActiveWorkspaceSpaceId();
    },
  };
});

vi.mock('@/hooks/useInterceptingRoutes', () => ({
  useOpenChatSettings: () => mockOpenSourceSettings,
}));

describe('AgentSourcesInline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-1');
    window.history.replaceState({}, '', '/');

    act(() => {
      useAgentStore.setState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            files: [
              {
                enabled: true,
                id: 'file-1',
                name: 'guide.md',
                spaceId: 'space-1',
                type: 'text/markdown',
              },
            ],
            sourceSets: [
              {
                enabled: true,
                id: 'kb-1',
                name: 'Handbook',
                spaceId: 'space-2',
              },
            ],
          } as any,
        },
        removeFileFromAgent,
        detachSourceSetFromAgent,
      });
    });
  });

  it('renders the inline entry and opens the attach modal', () => {
    render(<AgentSourcesInline />);

    expect(screen.getByRole('button', { name: 'Add Sources' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Handbook-icon Handbook · Shared Space' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'guide.md-icon guide.md' })).toBeInTheDocument();
    expect(screen.getByTestId('attach-sources-modal')).toHaveTextContent('closed');

    fireEvent.click(screen.getByRole('button', { name: 'Add Sources' }));

    expect(screen.getByTestId('attach-sources-modal')).toHaveTextContent('open:agent');
  });

  it('opens source settings when a tag is clicked', () => {
    render(<AgentSourcesInline />);

    fireEvent.click(screen.getByRole('button', { name: 'Handbook-icon Handbook · Shared Space' }));

    expect(mockOpenSourceSettings).toHaveBeenCalledTimes(1);
  });

  it('removes files and libraries directly from the inline tags', () => {
    render(<AgentSourcesInline />);

    fireEvent.click(screen.getByLabelText('remove-guide.md'));
    fireEvent.click(screen.getByLabelText('remove-Handbook · Shared Space'));

    expect(removeFileFromAgent).toHaveBeenCalledWith('file-1');
    expect(detachSourceSetFromAgent).toHaveBeenCalledWith('kb-1');
  });

  it('prefers the current route workspace when deciding whether a source is cross-space', () => {
    window.history.replaceState({}, '', '/spaces/space-route/files');

    act(() => {
      useAgentStore.setState({
        activeAgentId: 'agent-1',
        agentMap: {
          'agent-1': {
            files: [],
            sourceSets: [
              {
                enabled: true,
                id: 'kb-2',
                name: 'Route Handbook',
                spaceId: 'space-route',
              },
            ],
          } as any,
        },
        removeFileFromAgent,
        detachSourceSetFromAgent,
      });
    });

    render(<AgentSourcesInline />);

    expect(
      screen.getByRole('button', { name: 'Route Handbook-icon Route Handbook' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Route Handbook · Route Space')).not.toBeInTheDocument();
  });
});
