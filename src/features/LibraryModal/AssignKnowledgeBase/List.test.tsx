/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import List from './List';

const mockGetKnowledgeItems = vi.hoisted(() => vi.fn());

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
  Flexbox: ({ children }: any) => <div>{children}</div>,
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
    t: (key: string) =>
      ({
        'conversationFiles.library.action.add': 'Add to Conversation',
        'conversationFiles.library.action.addVisible': 'Add This View',
        'conversationFiles.library.action.added': 'Added',
        'conversationFiles.library.action.browse': 'Browse',
        'conversationFiles.library.action.upload': 'Upload Files',
        'conversationFiles.library.allFiles': 'Standalone Files',
        'conversationFiles.library.allFilesDesc': 'Files outside of any library.',
        'conversationFiles.library.empty': 'No files here yet.',
        'conversationFiles.library.emptySearch': 'No files match',
        'conversationFiles.library.scope': 'Current conversation',
        'conversationFiles.library.searchPlaceholder': 'Search library files',
        'conversationFiles.library.sources': 'Resources',
        'knowledgeBase.library.action.add': 'Add',
        'knowledgeBase.library.action.addLibrary': 'Add Library',
        'knowledgeBase.library.action.addVisible': 'Add This View',
        'knowledgeBase.library.action.added': 'Added',
        'knowledgeBase.library.action.browse': 'Browse',
        'knowledgeBase.library.action.upload': 'Upload Files',
        'knowledgeBase.library.allFiles': 'Standalone Files',
        'knowledgeBase.library.allFilesDesc': 'Files outside of any library.',
        'knowledgeBase.library.empty': 'No files here yet.',
        'knowledgeBase.library.scope': 'Agent knowledge',
        'knowledgeBase.library.searchPlaceholder': 'Search files in this location',
        'knowledgeBase.library.sources': 'Resources',
        'loading': 'Loading...',
        'networkError': 'Network error',
      })[key] || key,
  }),
}));

vi.mock('@/components/KnowledgeIcon', () => ({
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
    getKnowledgeItems: mockGetKnowledgeItems,
  },
}));

vi.mock('@/store/agent/selectors', () => ({
  agentSelectors: {
    currentAgentFiles: () => [],
    currentAgentKnowledgeBases: () => [],
  },
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: (state: any) => any) =>
    selector({
      activeAgentId: 'agent-1',
      addFilesToAgent: vi.fn(),
      addKnowledgeBaseToAgent: vi.fn(),
      removeFileFromAgent: vi.fn(),
      removeKnowledgeBaseFromAgent: vi.fn(),
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

vi.mock('@/store/library', () => ({
  useKnowledgeBaseStore: (selector: (state: any) => any) =>
    selector({
      useFetchKnowledgeBaseList: () => ({ data: [] }),
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

describe('KnowledgePickerList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses full file listing for agent scope', () => {
    render(<List scope="agent" />);

    expect(mockGetKnowledgeItems).toHaveBeenCalledWith(
      expect.objectContaining({
        attachableOnly: false,
      }),
    );
  });

  it('uses attachable-only listing for conversation scope', () => {
    render(<List scope="conversation" />);

    expect(mockGetKnowledgeItems).toHaveBeenCalledWith(
      expect.objectContaining({
        attachableOnly: true,
      }),
    );
  });

  it('keeps the empty state focused on import actions', () => {
    render(<List scope="agent" />);

    expect(screen.getByRole('button', { name: 'Upload Files' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Resources' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New Library' })).not.toBeInTheDocument();
    expect(screen.queryByText('0 libraries and 0 files added')).not.toBeInTheDocument();
    expect(screen.getAllByText('Standalone Files')).toHaveLength(1);
  });
});
