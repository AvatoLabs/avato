/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Navigator } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentStore } from '@/store/agent/store';
import { ChatSettingsTabs } from '@/store/global/initialState';

import AgentKnowledge from './index';

const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ icon: Icon, ...props }: any) => (
    <button type="button" {...props}>
      {Icon ? <Icon /> : 'action'}
    </button>
  ),
  Button: ({ children, icon: Icon, onClick, type }: any) => (
    <button data-type={type} type="button" onClick={onClick}>
      {Icon ? <Icon /> : null}
      {children}
    </button>
  ),
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  Empty: ({ children, description }: any) => (
    <div>
      <div>{description}</div>
      {children}
    </div>
  ),
  Flexbox: ({ as, children, ...props }: any) => {
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ as, children, ...props }: any) => {
    const Component = as || 'span';
    return <Component {...props}>{children}</Component>;
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    note: 'note',
    row: 'row',
    secondaryText: 'secondaryText',
    sectionTitle: 'sectionTitle',
    title: 'title',
  }),
}));

vi.mock('antd', () => ({
  Switch: ({ checked, onChange }: { checked?: boolean; onChange?: (checked: boolean) => void }) => (
    <input checked={checked} type="checkbox" onChange={(e) => onChange?.(e.target.checked)} />
  ),
}));

vi.mock('react-router-dom', async () => {
  const actual: Navigator = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => {
      if (key === 'settingKnowledge.count') return `${options?.count ?? 0} attached`;

      return (
        {
          'settingKnowledge.actions.add': 'Attach Knowledge',
          'settingKnowledge.actions.detail': 'Details',
          'settingKnowledge.actions.manage': 'Open Resource Center',
          'settingKnowledge.actions.remove': 'Remove',
          'settingKnowledge.badge.file': 'File',
          'settingKnowledge.badge.library': 'Library',
          'settingKnowledge.desc':
            'Manage long-term knowledge for this agent. Conversation attachments stay in the current session.',
          'settingKnowledge.emptyDesc':
            'Attach files or libraries from the resource center for long-term reuse across conversations.',
          'settingKnowledge.item.fileDesc': 'Long-term file knowledge',
          'settingKnowledge.item.libraryDesc': 'Long-term library knowledge',
          'settingKnowledge.scope.agent': 'Agent scope',
          'settingKnowledge.scope.conversation':
            'Conversation attachments only stay with the current session.',
          'settingKnowledge.section.files': 'Files',
          'settingKnowledge.section.libraries': 'Libraries',
          'settingKnowledge.title': 'Long-term Knowledge',
        }[key] || key
      );
    },
  }),
}));

vi.mock('@/components/KnowledgeIcon', () => ({
  default: ({ name }: { name: string }) => <div>{name} icon</div>,
}));

vi.mock('@/features/LibraryModal', () => ({
  AttachKnowledgeModal: ({ open, scope }: { open?: boolean; scope?: string }) => (
    <div data-testid="attach-knowledge-modal">{open ? `open:${scope}` : 'closed'}</div>
  ),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildResourceLibraryPath: (spaceId: string | null | undefined, libraryId: string) =>
    spaceId ? `/resource/space/${spaceId}/library/${libraryId}` : `/resource/library/${libraryId}`,
  buildResourcePreviewPath: (spaceId: string | null | undefined, fileId: string) =>
    spaceId ? `/resource/space/${spaceId}?file=${fileId}` : `/resource?file=${fileId}`,
}));

describe('AgentKnowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    act(() => {
      useAgentStore.setState({
        activeAgentId: 'agent-1',
        activeAgentSettingTab: ChatSettingsTabs.Knowledge,
        agentMap: {
          'agent-1': {
            files: [
              {
                enabled: true,
                id: 'file-1',
                name: 'guide.md',
                spaceId: null,
                type: 'text/markdown',
              },
            ],
            knowledgeBases: [
              {
                description: 'Team handbook',
                enabled: true,
                id: 'kb-1',
                name: 'Handbook',
                spaceId: 'space-1',
              },
            ],
          } as any,
        },
        showAgentSetting: true,
      });
    });
  });

  it('renders attached libraries and files and opens the attach modal', () => {
    render(<AgentKnowledge />);

    expect(screen.getByText('Long-term Knowledge')).toBeInTheDocument();
    expect(screen.getByText('2 attached')).toBeInTheDocument();
    expect(screen.getByText('Libraries')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Handbook')).toBeInTheDocument();
    expect(screen.getByText('guide.md')).toBeInTheDocument();
    expect(screen.getByTestId('attach-knowledge-modal')).toHaveTextContent('closed');

    fireEvent.click(screen.getByRole('button', { name: 'Attach Knowledge' }));

    expect(screen.getByTestId('attach-knowledge-modal')).toHaveTextContent('open:agent');
  });

  it('closes the settings modal state before navigating to the resource center', () => {
    render(<AgentKnowledge />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Resource Center' }));

    expect(mockNavigate).toHaveBeenCalledWith('/resource');
    expect(useAgentStore.getState().showAgentSetting).toBe(false);
    expect(useAgentStore.getState().activeAgentSettingTab).toBeUndefined();
  });
});
