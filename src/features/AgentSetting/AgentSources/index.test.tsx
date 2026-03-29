/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { Navigator } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useAgentStore } from '@/store/agent/store';
import { ChatSettingsTabs } from '@/store/global/initialState';

import AgentSources from './index';

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
      if (key === 'settingSources.count') return `${options?.count ?? 0} attached`;

      return (
        {
          'settingSources.actions.add': 'Attach Sources',
          'settingSources.actions.detail': 'Details',
          'settingSources.actions.manage': 'Open Content',
          'settingSources.actions.remove': 'Remove',
          'settingSources.badge.file': 'File',
          'settingSources.badge.sourceSet': 'Source Set',
          'settingSources.desc':
            'Manage long-term sources for this agent. Conversation attachments stay in the current session.',
          'settingSources.emptyDesc':
            'Attach files or source sets from Content for long-term reuse across conversations.',
          'settingSources.item.fileDesc': 'Long-term file source',
          'settingSources.item.sourceSetDesc': 'Long-term source set',
          'settingSources.scope.agent': 'Agent scope',
          'settingSources.scope.conversation':
            'Conversation attachments only stay with the current session.',
          'settingSources.section.files': 'Files',
          'settingSources.section.sourceSets': 'Source Sets',
          'settingSources.title': 'Long-term Sources',
        }[key] || key
      );
    },
  }),
}));

vi.mock('@/components/SourceIcon', () => ({
  default: ({ name }: { name: string }) => <div>{name} icon</div>,
}));

vi.mock('@/features/SourceSetModal', () => ({
  AttachSourceSetModal: ({ open, scope }: { open?: boolean; scope?: string }) => (
    <div data-testid="attach-sources-modal">{open ? `open:${scope}` : 'closed'}</div>
  ),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  useSpaceName: (spaceId?: string | null) =>
    ({ 'space-1': 'My Space', 'space-2': 'Shared Space' })[spaceId || ''],
  buildContentRootPath: (spaceId: string | null | undefined) =>
    spaceId ? `/content/spaces/${spaceId}` : '/content',
  buildSourceSetPath: (spaceId: string | null | undefined, sourceSetId: string) =>
    spaceId
      ? `/content/spaces/${spaceId}/source-sets/${sourceSetId}`
      : `/content/source-sets/${sourceSetId}`,
  buildContentPreviewPath: (spaceId: string | null | undefined, fileId: string) =>
    spaceId ? `/content/spaces/${spaceId}?file=${fileId}` : `/content?file=${fileId}`,
}));

describe('AgentSources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActiveWorkspaceSpaceId('space-1');

    act(() => {
      useAgentStore.setState({
        activeAgentId: 'agent-1',
        activeAgentSettingTab: ChatSettingsTabs.Sources,
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
            sourceSets: [
              {
                description: 'Team handbook',
                enabled: true,
                id: 'kb-1',
                name: 'Handbook',
                spaceId: 'space-2',
              },
            ],
          } as any,
        },
        showAgentSetting: true,
      });
    });
  });

  it('renders attached source sets and files and opens the attach modal', () => {
    render(<AgentSources />);

    expect(screen.getByText('Long-term Sources')).toBeInTheDocument();
    expect(screen.getByText('2 attached')).toBeInTheDocument();
    expect(screen.getByText('Source Sets')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Handbook')).toBeInTheDocument();
    expect(screen.getByText('guide.md')).toBeInTheDocument();
    expect(screen.getByText('Shared Space')).toBeInTheDocument();
    expect(screen.getByTestId('attach-sources-modal')).toHaveTextContent('closed');

    fireEvent.click(screen.getByRole('button', { name: 'Attach Sources' }));

    expect(screen.getByTestId('attach-sources-modal')).toHaveTextContent('open:agent');
  });

  it('closes the settings modal state before navigating to the resource center', () => {
    render(<AgentSources />);

    fireEvent.click(screen.getByRole('button', { name: 'Open Content' }));

    expect(mockNavigate).toHaveBeenCalledWith('/content/spaces/space-1');
    expect(useAgentStore.getState().showAgentSetting).toBe(false);
    expect(useAgentStore.getState().activeAgentSettingTab).toBeUndefined();
  });
});
