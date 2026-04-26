/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PageExplorerPlaceholder from './PageExplorerPlaceholder';

const mockCreateNewPage = vi.hoisted(() => vi.fn());
const mockCreateNewTable = vi.hoisted(() => vi.fn());
const mockCreateOptimisticPage = vi.hoisted(() => vi.fn());
const mockReplaceTempPageWithReal = vi.hoisted(() => vi.fn());
const mockSetSelectedPageId = vi.hoisted(() => vi.fn());
const mockCreatePage = vi.hoisted(() => vi.fn());
const mockRemoveTempPage = vi.hoisted(() => vi.fn());
const mockUploadWithProgress = vi.hoisted(() => vi.fn());
const mockParseDocument = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const { useFileStoreMock, usePageStoreMock } = vi.hoisted(() => ({
  useFileStoreMock: Object.assign(
    (selector: any) =>
      selector({
        uploadWithProgress: mockUploadWithProgress,
      }),
    {
      getState: () => ({
        uploadWithProgress: mockUploadWithProgress,
      }),
    },
  ),
  usePageStoreMock: Object.assign(
    (selector: any) =>
      selector({
        createNewPage: mockCreateNewPage,
        createNewTable: mockCreateNewTable,
        createOptimisticPage: mockCreateOptimisticPage,
        replaceTempPageWithReal: mockReplaceTempPageWithReal,
        setSelectedPageId: mockSetSelectedPageId,
        createPage: mockCreatePage,
      }),
    {
      getState: () => ({
        removeTempPage: mockRemoveTempPage,
      }),
    },
  ),
}));

vi.mock('@lobehub/ui', () => ({
  Center: ({ children }: any) => <div>{children}</div>,
  FileTypeIcon: ({ icon }: any) => <div>{icon}</div>,
  Flexbox: ({ children, onClick, onKeyDown, ...props }: any) => (
    <div onClick={onClick} onKeyDown={onKeyDown} {...props}>
      {children}
    </div>
  ),
  Icon: ({ icon: IconComp }: any) => (IconComp ? <IconComp /> : <span>icon</span>),
  Text: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (factory: any) =>
    factory({
      css: () => '',
      cssVar: {
        colorBgContainer: '#fff',
        colorBorder: '#ddd',
        colorBorderSecondary: '#ddd',
        colorFillSecondary: '#f5f5f5',
        colorFillTertiary: '#eee',
        colorPrimary: '#1677ff',
        colorPrimaryBg: '#e6f4ff',
        colorPrimaryBorder: '#91caff',
        colorText: '#000',
        colorTextLightSolid: '#fff',
        colorTextSecondary: '#666',
        colorTextTertiary: '#999',
      },
    }),
  cssVar: {
    colorPrimary: '#1677ff',
    colorTextLightSolid: '#fff',
    colorTextSecondary: '#666',
    colorTextTertiary: '#999',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/AntdStaticMethods', () => ({
  message: {
    error: mockMessageError,
  },
}));

vi.mock('@/store/docs', () => ({
  usePageStore: usePageStoreMock,
}));

vi.mock('@/store/file', () => ({
  useFileStore: useFileStoreMock,
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    document: {
      parseDocument: {
        mutate: mockParseDocument,
      },
    },
  },
}));

describe('PageExplorerPlaceholder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateOptimisticPage.mockReturnValue('temp-page-1');
    mockUploadWithProgress.mockResolvedValue({ id: 'file-1' });
  });

  it('shows an error when creating a new doc fails', async () => {
    const error = new Error('create failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateNewPage.mockRejectedValue(error);

    render(<PageExplorerPlaceholder />);
    fireEvent.click(screen.getByText('docEditor.empty.createNewDocument'));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('docEditor.empty.createError');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create page:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when importing a PDF doc fails after upload', async () => {
    const error = new Error('parse failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockParseDocument.mockRejectedValue(error);

    const { container } = render(<PageExplorerPlaceholder />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['pdf'], 'guide.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('docEditor.empty.importError');
    });
    expect(mockRemoveTempPage).toHaveBeenCalledWith('temp-page-1');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to upload and parse file:', error);

    consoleErrorSpy.mockRestore();
  });
});
