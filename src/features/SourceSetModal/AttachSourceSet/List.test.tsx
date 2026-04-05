/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';

import List from './List';

const mockGetSourceItems = vi.hoisted(() => vi.fn());
const mockUseFetchSourceSetList = vi.hoisted(() => vi.fn(() => ({ data: [] })));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick }: any) => (
    <button type="button" onClick={onClick}>
      back
    </button>
  ),
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Center: ({ children }: any) => <div>{children}</div>,
  Empty: ({ description }: any) => <div>{description}</div>,
  Flexbox: ({ as, children, ...props }: any) => {
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
  Icon: () => <span>icon</span>,
  SearchBar: ({ onChange, placeholder, value }: any) => (
    <input placeholder={placeholder} value={value} onChange={onChange} />
  ),
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    actionButton: 'actionButton',
    breadcrumbButton: 'breadcrumbButton',
    container: 'container',
    content: 'content',
    countText: 'countText',
    emptyActions: 'emptyActions',
    emptyHint: 'emptyHint',
    itemRow: 'itemRow',
    itemSecondary: 'itemSecondary',
    itemTitle: 'itemTitle',
    locationBar: 'locationBar',
    panelTitle: 'panelTitle',
    sourceItem: 'sourceItem',
    sourceItemActive: 'sourceItemActive',
    sourceSecondary: 'sourceSecondary',
    sourceSidebar: 'sourceSidebar',
    sourceTitle: 'sourceTitle',
    titleRow: 'titleRow',
  }),
  cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) =>
      ({
        'conversationFiles.picker.action.add': 'Add to Conversation',
        'conversationFiles.picker.action.addVisible': 'Add This View',
        'conversationFiles.picker.action.added': 'Added',
        'conversationFiles.picker.action.browse': 'Browse',
        'conversationFiles.picker.action.upload': 'Upload Files',
        'conversationFiles.picker.allFiles': 'Standalone Files',
        'conversationFiles.picker.allFilesDesc': 'Files outside any source set.',
        'conversationFiles.picker.empty': 'No files here yet.',
        'conversationFiles.picker.emptySearch': 'No files match',
        'conversationFiles.picker.scope': 'Current conversation',
        'conversationFiles.picker.searchPlaceholder': 'Search files and folders',
        'conversationFiles.picker.sources': 'Resources',
        'sourceSet.picker.action.add': 'Add',
        'sourceSet.picker.action.addSourceSet': 'Add Source Set',
        'sourceSet.picker.action.addVisible': 'Add This View',
        'sourceSet.picker.action.added': 'Added',
        'sourceSet.picker.action.browse': 'Browse',
        'sourceSet.picker.action.upload': 'Upload Files',
        'sourceSet.picker.allFiles': 'Standalone Files',
        'sourceSet.picker.allFilesDesc': 'Files outside any source set.',
        'sourceSet.picker.empty': 'No files here yet.',
        'sourceSet.picker.scope': 'Agent knowledge',
        'sourceSet.picker.searchPlaceholder': 'Search files in this location',
        'sourceSet.picker.sourceWorkspace': `From ${options?.name}`,
        'sourceSet.picker.sources': 'Resources',
        'sourceSet.picker.workspace': 'Workspace',
        'sourceSet.picker.workspaceHint': `Browsing content from ${options?.name} first.`,
        'loading': 'Loading...',
        'networkError': 'Network error',
      })[key] || key,
  }),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  useSpaceName: (spaceId?: string | null) =>
    ({
      'space-route': 'Ops Workspace',
      'space-shared': 'Shared Workspace',
      'spc_test': 'Hint Workspace',
    })[spaceId || ''],
}));

vi.mock('@/components/SourceIcon', () => ({
  default: () => <span>file-icon</span>,
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: (_key: unknown, fetcher?: () => unknown) => {
    if (fetcher) fetcher();

    return {
      data: { hasMore: false, items: [] },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
    };
  },
}));

vi.mock('@/services/file', () => ({
  fileService: {
    getKnowledgeItems: mockGetSourceItems,
  },
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentFiles: () => [],
    currentAgentSourceSets: () => [],
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: (state: any) => any) =>
    selector({
      activeAgentId: 'agent-1',
      addFilesToAgent: vi.fn(),
      attachSourceSetToAgent: vi.fn(),
      removeFileFromAgent: vi.fn(),
      detachSourceSetFromAgent: vi.fn(),
    }),
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: (state: any) => any) =>
    selector({
      activeGroupId: null,
    }),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: (state: any) => any) =>
    selector({
      parseFilesToChunks: vi.fn(),
      refreshFileList: vi.fn(),
      uploadWithProgress: vi.fn(),
    }),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: (state: any) => any) =>
    selector({
      useFetchSourceSetList: mockUseFetchSourceSetList,
    }),
}));

vi.mock('@/store/session/store', () => ({
  useSessionStore: (selector: (state: any) => any) =>
    selector({
      addFilesToConversation: vi.fn(),
      deleteConversationFile: vi.fn(),
      useFetchConversationFiles: () => ({ data: [] }),
    }),
}));

describe('SourceSetPickerList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFetchSourceSetList.mockReturnValue({
      data: [
        {
          description: 'Shared handbook',
          id: 'ss-1',
          name: 'Handbook',
          spaceId: 'space-shared',
        },
      ],
    });
    setActiveWorkspaceSpaceId('spc_test');
    window.history.replaceState({}, '', '/spaces/space-route/files');
  });

  it('uses the current route workspace for source sets and shows workspace context', () => {
    render(<List scope="agent" />);

    expect(mockUseFetchSourceSetList).toHaveBeenCalledWith('space-route');
    expect(mockGetSourceItems).toHaveBeenCalledWith(
      expect.objectContaining({
        attachableOnly: false,
        spaceId: 'space-route',
      }),
    );
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Browsing content from Ops Workspace first.')).toBeInTheDocument();
    expect(screen.getByText('From Shared Workspace')).toBeInTheDocument();
  });

  it('uses attachable-only listing for conversation scope', () => {
    render(<List scope="conversation" />);

    expect(mockGetSourceItems).toHaveBeenCalledWith(
      expect.objectContaining({
        attachableOnly: true,
        spaceId: 'space-route',
      }),
    );
  });

  it('switches file queries to the selected source set workspace', async () => {
    render(<List scope="agent" />);

    fireEvent.click(screen.getByText('Handbook'));

    await waitFor(() => {
      expect(mockGetSourceItems).toHaveBeenLastCalledWith(
        expect.objectContaining({
          sourceSetId: 'ss-1',
          spaceId: 'space-shared',
        }),
      );
    });
  });

  it('keeps the empty state focused on import actions', () => {
    render(<List scope="agent" />);

    expect(screen.getByRole('button', { name: 'Upload Files' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Resources' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Source Set' })).not.toBeInTheDocument();
    expect(screen.queryByText('0 source sets and 0 files added')).not.toBeInTheDocument();
    expect(screen.getAllByText('Standalone Files')).toHaveLength(1);
  });
});
