/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PAGE_EDITOR_SCROLL_ROOT_ID } from './constants';
import TitleSection from './TitleSection';

const { mocks } = vi.hoisted(() => ({
  mocks: {
    emojiPicker: vi.fn(() => <div data-testid="emoji-picker" />),
  },
}));

let documentState = {
  content: '## Overview\n\nText\n\n## Overview\n\nMore text',
  lastUpdatedTime: new Date('2026-03-28T12:00:00.000Z'),
  saveStatus: 'idle',
};

let pageEditorState = {
  documentId: 'doc-1',
  emoji: '📄',
  handleTitleSubmit: vi.fn(),
  setEmoji: vi.fn(),
  setTitle: vi.fn(),
  title: 'My Page',
};
let pageDocument = {
  id: 'doc-1',
  parentId: null,
  sourceSetId: 'ss-1',
  spaceId: 'space-1',
};
const navigateMock = vi.fn();
const messageSuccessMock = vi.fn();
const messageWarningMock = vi.fn();
const messageErrorMock = vi.fn();
const refreshDocumentsMock = vi.fn();

const sourceSetStoreState = {
  activeSourceSetItems: {
    'ss-1': { description: '', id: 'ss-1', name: 'Research Set' },
    'ss-2': { description: '', id: 'ss-2', name: 'Design Set' },
  },
};

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: ({ icon: IconComp }: any) => (IconComp ? <IconComp data-testid="icon" /> : null),
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children, ...rest }: any) => <span {...rest}>{children}</span>,
  TextArea: ({ onChange, onKeyDown, value }: any) => (
    <textarea
      data-testid="title-input"
      value={value}
      onChange={(event) => onChange(event)}
      onKeyDown={(event) => onKeyDown(event)}
    />
  ),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (key === 'docEditor.outline') return 'Outline';
      if (key === 'docEditor.wordCount') return `${params.wordCount} words`;
      if (key === 'docEditor.editedAt') return `Last edited on ${params.time}`;
      if (key === 'docEditor.updatedAt') return `Updated ${params.time}`;
      if (key === 'docEditor.titlePlaceholder') return 'Untitled';
      if (key === 'docEditor.chooseIcon') return 'Choose Icon';
      if (key === 'FileManager.actions.addToSourceSet') return 'Add to Source Set';
      if (key === 'FileManager.actions.moveToOtherSourceSet') return 'Move to another Source Set';
      return key;
    },
  }),
}));

vi.mock('@/components/EmojiPicker', () => ({
  default: mocks.emojiPicker,
}));

vi.mock('@/features/ResourceSpaces/useSpaceName', () => ({
  useSpaceName: vi.fn(() => 'Product Space'),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildFilesRootPath: (spaceId?: string | null) =>
    spaceId ? `/spaces/${spaceId}/files` : '/spaces',
  buildSourceSetPath: (spaceId: string | null | undefined, sourceSetId: string) =>
    spaceId ? `/spaces/${spaceId}/files?scope=source-set:${sourceSetId}` : '/spaces',
  useSpaceName: vi.fn(() => 'Product Space'),
}));

vi.mock('@/store/document', () => ({
  useDocumentStore: vi.fn((selector: any) =>
    selector({
      editor: {
        'doc-1': {
          content: documentState.content,
          lastUpdatedTime: documentState.lastUpdatedTime,
          saveStatus: documentState.saveStatus,
        },
      },
    }),
  ),
}));

vi.mock('@/store/document/slices/editor', () => ({
  editorSelectors: {
    content: (id: string) => (state: any) => state.editor[id]?.content ?? '',
    lastUpdatedTime: (id: string) => (state: any) => state.editor[id]?.lastUpdatedTime,
    saveStatus: (id: string) => (state: any) => state.editor[id]?.saveStatus ?? 'idle',
    spaceId: () => () => undefined,
  },
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: vi.fn(() => 'en-US'),
}));

vi.mock('@/store/global/selectors', () => ({
  globalGeneralSelectors: {
    currentLanguage: 'currentLanguage',
  },
}));

vi.mock('@/store/docs', () => ({
  pageSelectors: {
    getDocumentById: () => () => pageDocument,
  },
  usePageStore: vi.fn((selector: any) =>
    selector({
      documents: [pageDocument],
      refreshDocuments: refreshDocumentsMock,
    }),
  ),
}));

vi.mock('@/store/file', () => ({
  useFileStore: vi.fn((selector: any) =>
    selector({
      moveContentItem: vi.fn(),
    }),
  ),
}));

vi.mock('@/store/sourceSet', () => ({
  sourceSetSelectors: {
    getSourceSetNameById: (id: string) => (state: any) => state.activeSourceSetItems[id]?.name,
  },
  useSourceSetStore: vi.fn((selector: any) => selector(sourceSetStoreState)),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: messageErrorMock,
        success: messageSuccessMock,
        warning: messageWarningMock,
      },
    }),
  },
}));

vi.mock('./store', () => ({
  usePageEditorStore: vi.fn((selector: any) => selector(pageEditorState)),
  useStoreApi: vi.fn(() => ({
    setState: vi.fn(),
  })),
}));

describe('TitleSection', () => {
  beforeEach(() => {
    documentState = {
      content: '## Overview\n\nText\n\n## Overview\n\nMore text',
      lastUpdatedTime: new Date('2026-03-28T12:00:00.000Z'),
      saveStatus: 'idle',
    };
    pageEditorState = {
      documentId: 'doc-1',
      emoji: '📄',
      handleTitleSubmit: vi.fn(),
      setEmoji: vi.fn(),
      setTitle: vi.fn(),
      title: 'My Page',
    };
    pageDocument = {
      id: 'doc-1',
      parentId: null,
      sourceSetId: 'ss-1',
      spaceId: 'space-1',
    };
    vi.clearAllMocks();
  });

  it('renders the outline panel as a list of jump targets', () => {
    const formattedUpdatedAt = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(documentState.lastUpdatedTime);

    render(<TitleSection />);

    expect(screen.getAllByText('Outline')).toHaveLength(2);
    expect(screen.getByText(/^2$/)).toBeInTheDocument();
    expect(screen.getByText(`Updated ${formattedUpdatedAt}`)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Product Space/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Research Set/ })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Move to another Source Set' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Remove from Source Set' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('autosave-doc-1')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Overview/ })).toHaveLength(2);
    expect(screen.queryByText('01')).not.toBeInTheDocument();
  });

  it('keeps the outline list scrollable inside the card', () => {
    render(<TitleSection />);

    const outlineTree = screen.getByRole('tree', { name: 'Outline' });

    expect(outlineTree).toHaveAttribute('tabindex', '0');
    expect(outlineTree).toBeInTheDocument();
  });

  it('jumps to the matching duplicate heading by outline order', () => {
    const scrollRoot = document.createElement('div');
    scrollRoot.id = PAGE_EDITOR_SCROLL_ROOT_ID;

    const firstHeading = document.createElement('h2');
    firstHeading.textContent = 'Overview';
    firstHeading.scrollIntoView = vi.fn();

    const secondHeading = document.createElement('h2');
    secondHeading.textContent = 'Overview';
    secondHeading.scrollIntoView = vi.fn();

    scrollRoot.append(firstHeading, secondHeading);
    document.body.append(scrollRoot);

    render(<TitleSection />);

    fireEvent.click(screen.getAllByRole('button', { name: /Overview/ })[1]);

    expect(firstHeading.scrollIntoView).not.toHaveBeenCalled();
    expect(secondHeading.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'center',
    });
  });

  it('opens the owning space when clicking the space chip', () => {
    render(<TitleSection />);

    fireEvent.click(screen.getByRole('button', { name: /Product Space/ }));

    expect(navigateMock).toHaveBeenCalledWith('/spaces/space-1/docs');
  });
});
