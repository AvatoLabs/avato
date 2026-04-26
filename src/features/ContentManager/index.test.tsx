/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ContentManager from './index';

const navigateMock = vi.hoisted(() => vi.fn());
const dragUploadZoneMock = vi.hoisted(() => vi.fn());
const pushDockFileListMock = vi.hoisted(() => vi.fn());
const updateDocumentOptimisticallyMock = vi.hoisted(() => vi.fn());
const setCurrentViewItemIdMock = vi.hoisted(() => vi.fn());
const setModeMock = vi.hoisted(() => vi.fn());

interface MockDocument {
  content: string | null;
  createdAt: Date;
  fileType: string;
  id: string;
  metadata: Record<string, unknown>;
  source: 'document';
  sourceType: 'editor';
  title: string;
  totalCharCount: number;
  totalLineCount: number;
  updatedAt: Date;
}

const documentRecord = vi.hoisted<Record<string, MockDocument>>(() => ({
  'doc-1': {
    content: 'draft',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    fileType: 'md',
    id: 'doc-1',
    metadata: {},
    source: 'document',
    sourceType: 'editor',
    title: 'Doc 1',
    totalCharCount: 5,
    totalLineCount: 1,
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
}));

const contentManagerState = vi.hoisted(() => ({
  currentFolderId: 'folder-1' as string | null,
  currentViewItemId: 'file-1' as string | undefined,
  mode: 'explorer' as 'doc' | 'editor' | 'explorer',
  setCurrentViewItemId: setCurrentViewItemIdMock,
  setMode: setModeMock,
  sourceSetId: 'source-set-1' as string | undefined,
  spaceId: 'space-1' as string | undefined,
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    container: 'container',
    docEditorOverlay: 'docEditorOverlay',
    editorOverlay: 'editorOverlay',
    explorerStage: 'explorerStage',
    explorerStage_inert: 'explorerStage_inert',
    overlayStage: 'overlayStage',
    overlayStage_doc: 'overlayStage_doc',
    overlayStage_editor: 'overlayStage_editor',
  }),
  useTheme: () => ({
    colorBgContainerSecondary: '#f5f5f5',
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({
    pathname: '/spaces/space-1/files',
    search: '?file=file-1',
  }),
  useNavigate: () => navigateMock,
}));

vi.mock('@/components/DragUploadZone', () => ({
  default: (props: any) => {
    dragUploadZoneMock(props);
    return <div>{props.children}</div>;
  },
}));

vi.mock('@/features/PageEditor', () => ({
  PageEditor: () => <div>page-editor</div>,
}));

vi.mock('@/features/ResourceSpaces', () => ({
  stripFilesItemPath: (path: string) => path,
}));

vi.mock('@/libs/next/dynamic', () => ({
  default: () => () => <div>chunk-drawer</div>,
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) => selector(contentManagerState),
}));

vi.mock('@/services/document', () => ({
  documentService: {
    getDocumentById: vi.fn(),
  },
}));

vi.mock('@/services/utils/abortableRequest', () => ({
  abortableRequest: {
    cancel: vi.fn(),
  },
}));

vi.mock('@/store/file/slices/document/selectors', () => ({
  documentSelectors: {
    getDocumentById: (id?: string) => () => (id ? documentRecord[id] : undefined),
  },
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) =>
    selector({
      pushDockFileList: pushDockFileListMock,
      updateDocumentOptimistically: updateDocumentOptimisticallyMock,
    }),
}));

vi.mock('@/utils/docs', () => ({
  getPageKindFromDocument: () => 'document',
}));

vi.mock('./components/Editor', () => ({
  default: ({ onBack }: any) => (
    <div>
      <button type={'button'} onClick={onBack}>
        back
      </button>
      <span>file-editor</span>
    </div>
  ),
}));

vi.mock('./components/Explorer', () => ({
  default: () => <div>explorer</div>,
}));

vi.mock('./components/UploadDock', () => ({
  default: () => <div>upload-dock</div>,
}));

describe('ContentManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    contentManagerState.currentFolderId = 'folder-1';
    contentManagerState.currentViewItemId = 'file-1';
    contentManagerState.mode = 'explorer';
    contentManagerState.sourceSetId = 'source-set-1';
    contentManagerState.spaceId = 'space-1';
  });

  it('keeps explorer active in explorer mode', () => {
    render(<ContentManager />);

    const explorerStage = screen.getByTestId('content-manager-explorer-stage');

    expect(dragUploadZoneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: false,
      }),
    );
    expect(explorerStage).toHaveAttribute('aria-hidden', 'false');
    expect(explorerStage.className).toContain('explorerStage');
    expect(explorerStage.className).not.toContain('explorerStage_inert');
    expect(screen.getByText('explorer')).toBeInTheDocument();
  });

  it('keeps explorer mounted but makes it inert when the file editor is open', () => {
    contentManagerState.mode = 'editor';

    render(<ContentManager />);

    const explorerStage = screen.getByTestId('content-manager-explorer-stage');

    expect(dragUploadZoneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: true,
      }),
    );
    expect(screen.getByText('explorer')).toBeInTheDocument();
    expect(screen.getByText('file-editor')).toBeInTheDocument();
    expect(screen.getByTestId('content-manager-editor-stage').className).toContain('overlayStage');
    expect(explorerStage).toHaveAttribute('aria-hidden', 'true');
    expect(explorerStage.className).toContain('explorerStage_inert');
  });

  it('also hides explorer interactions when the doc editor is open', () => {
    contentManagerState.currentViewItemId = 'doc-1';
    contentManagerState.mode = 'doc';

    render(<ContentManager />);

    const explorerStage = screen.getByTestId('content-manager-explorer-stage');

    expect(dragUploadZoneMock).toHaveBeenCalledWith(
      expect.objectContaining({
        disabled: true,
      }),
    );
    expect(screen.getByText('explorer')).toBeInTheDocument();
    expect(screen.getByText('page-editor')).toBeInTheDocument();
    expect(screen.getByTestId('content-manager-doc-stage').className).toContain('overlayStage');
    expect(explorerStage).toHaveAttribute('aria-hidden', 'true');
    expect(explorerStage.className).toContain('explorerStage_inert');
  });
});
