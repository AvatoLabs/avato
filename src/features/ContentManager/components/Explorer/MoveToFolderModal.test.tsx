/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import MoveToFolderModal from './MoveToFolderModal';

const mockCreateFolder = vi.hoisted(() => vi.fn());
const mockMoveContentItem = vi.hoisted(() => vi.fn());
const mockOnClose = vi.hoisted(() => vi.fn());
const mockGetKnowledgeItems = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, disabled, icon, loading, onClick, type: _type }: any) => (
    <button disabled={disabled || loading} type="button" onClick={onClick}>
      {icon}
      {children}
    </button>
  ),
  Flexbox: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Icon: () => <span aria-hidden="true">icon</span>,
  Modal: ({ children, footer, open, title }: any) =>
    open ? (
      <div>
        <div>{title}</div>
        {children}
        {footer}
      </div>
    ) : null,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
        success: mockMessageSuccess,
      },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    folder: () => <span>folder</span>,
  },
}));

vi.mock('@/features/ContentManager/components/FolderTree', () => ({
  __esModule: true,
  default: () => <div>folder-tree</div>,
}));

vi.mock('@/features/ContentManager/components/SourceSetTree/treeState', () => ({
  clearTreeFolderCache: vi.fn(),
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) =>
    selector({
      spaceId: 'space-123',
    }),
}));

vi.mock('@/services/file', () => ({
  fileService: {
    getKnowledgeItems: mockGetKnowledgeItems,
  },
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) =>
    selector({
      createFolder: mockCreateFolder,
      moveContentItem: mockMoveContentItem,
    }),
}));

describe('MoveToFolderModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateFolder.mockResolvedValue('folder-1');
    mockGetKnowledgeItems.mockResolvedValue({ items: [] });
  });

  it('passes the active workspace spaceId when creating a folder', async () => {
    render(
      <MoveToFolderModal
        fileId="file-1"
        open
        sourceSetId="source-set-1"
        onClose={mockOnClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'header.actions.newFolder' }));

    await waitFor(() => {
      expect(mockCreateFolder).toHaveBeenCalledWith(
        'pageList.untitled',
        undefined,
        'source-set-1',
        'space-123',
      );
    });
  });

  it('shows an error when loading folders fails', async () => {
    const error = new Error('load failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetKnowledgeItems.mockRejectedValue(error);

    render(
      <MoveToFolderModal
        fileId="file-1"
        open
        sourceSetId="source-set-1"
        onClose={mockOnClose}
      />,
    );

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('FileManager.loadFoldersError');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load folders:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows the correct error when creating a folder fails', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateFolder.mockRejectedValue(error);

    render(
      <MoveToFolderModal
        fileId="file-1"
        open
        sourceSetId="source-set-1"
        onClose={mockOnClose}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'header.actions.newFolder' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('header.actions.createFolderError');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create folder:', error);

    consoleErrorSpy.mockRestore();
  });
});
