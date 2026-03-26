/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentStore } from '@/store/agent/store';

import AgentKnowledgeInline from './AgentKnowledgeInline';

const mockOpenKnowledgeSettings = vi.hoisted(() => vi.fn());
const removeFileFromAgent = vi.hoisted(() => vi.fn());
const removeKnowledgeBaseFromAgent = vi.hoisted(() => vi.fn());

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
        'settingKnowledge.inlineAdd': 'Add Knowledge',
      })[key] || key,
  }),
}));

vi.mock('@/components/KnowledgeIcon', () => ({
  default: ({ name }: { name: string }) => <span>{name}-icon</span>,
}));

vi.mock('@/features/LibraryModal', () => ({
  AttachKnowledgeModal: ({ open, scope }: { open?: boolean; scope?: string }) => (
    <div data-testid="attach-knowledge-modal">{open ? `open:${scope}` : 'closed'}</div>
  ),
}));

vi.mock('@/hooks/useInterceptingRoutes', () => ({
  useOpenChatSettings: () => mockOpenKnowledgeSettings,
}));

describe('AgentKnowledgeInline', () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
                type: 'text/markdown',
              },
            ],
            knowledgeBases: [
              {
                enabled: true,
                id: 'kb-1',
                name: 'Handbook',
              },
            ],
          } as any,
        },
        removeFileFromAgent,
        removeKnowledgeBaseFromAgent,
      });
    });
  });

  it('renders the inline entry and opens the attach modal', () => {
    render(<AgentKnowledgeInline />);

    expect(screen.getByRole('button', { name: 'Add Knowledge' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Handbook-icon Handbook' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'guide.md-icon guide.md' })).toBeInTheDocument();
    expect(screen.getByTestId('attach-knowledge-modal')).toHaveTextContent('closed');

    fireEvent.click(screen.getByRole('button', { name: 'Add Knowledge' }));

    expect(screen.getByTestId('attach-knowledge-modal')).toHaveTextContent('open:agent');
  });

  it('opens knowledge settings when a tag is clicked', () => {
    render(<AgentKnowledgeInline />);

    fireEvent.click(screen.getByRole('button', { name: 'Handbook-icon Handbook' }));

    expect(mockOpenKnowledgeSettings).toHaveBeenCalledTimes(1);
  });

  it('removes files and libraries directly from the inline tags', () => {
    render(<AgentKnowledgeInline />);

    fireEvent.click(screen.getByLabelText('remove-guide.md'));
    fireEvent.click(screen.getByLabelText('remove-Handbook'));

    expect(removeFileFromAgent).toHaveBeenCalledWith('file-1');
    expect(removeKnowledgeBaseFromAgent).toHaveBeenCalledWith('kb-1');
  });
});
