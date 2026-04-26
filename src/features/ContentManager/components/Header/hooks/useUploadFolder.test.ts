/**
 * @vitest-environment happy-dom
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import useUploadFolder from './useUploadFolder';

const mockFilterFilesByBuiltInBlockList = vi.hoisted(() => vi.fn());
const mockFilterFilesByGitignore = vi.hoisted(() => vi.fn());
const mockFindGitignoreFile = vi.hoisted(() => vi.fn());
const mockMessageInfo = vi.hoisted(() => vi.fn());
const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockReadGitignoreContent = vi.hoisted(() => vi.fn());
const mockUploadFolderWithStructure = vi.hoisted(() => vi.fn());

vi.mock('antd', () => ({
  Modal: {
    confirm: mockModalConfirm,
  },
  message: {
    info: mockMessageInfo,
  },
}));

vi.mock('../../../../../utils/gitignore', () => ({
  filterFilesByBuiltInBlockList: mockFilterFilesByBuiltInBlockList,
  filterFilesByGitignore: mockFilterFilesByGitignore,
  findGitignoreFile: mockFindGitignoreFile,
  readGitignoreContent: mockReadGitignoreContent,
}));

describe('useUploadFolder', () => {
  const t = (key: string) => key;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockFilterFilesByBuiltInBlockList.mockImplementation((files) => files);
    mockFilterFilesByGitignore.mockImplementation((files) => files);
    mockFindGitignoreFile.mockReturnValue(new File(['ignored'], '.gitignore'));
    mockReadGitignoreContent.mockResolvedValue('dist/\n');
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('catches background upload errors when gitignore is ignored', async () => {
    const file = new File(['content'], 'README.md');
    const uploadError = new Error('upload failed');
    mockUploadFolderWithStructure.mockRejectedValue(uploadError);

    const { result } = renderHook(() =>
      useUploadFolder({
        currentFolderId: 'fld_1',
        sourceSetId: 'sst_1',
        spaceId: 'spc_1',
        t: t as any,
        uploadFolderWithStructure: mockUploadFolderWithStructure,
      }),
    );

    await act(async () => {
      await result.current.handleFolderUpload({
        target: { files: [file], value: 'README.md' },
      } as any);
    });

    const confirmConfig = mockModalConfirm.mock.calls.at(-1)?.[0];
    expect(confirmConfig).toBeDefined();

    confirmConfig.onCancel();

    await waitFor(() => {
      expect(mockUploadFolderWithStructure).toHaveBeenCalledWith(
        [file],
        'sst_1',
        'fld_1',
        'spc_1',
      );
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to upload folder:', uploadError);
    });
  });

  it('catches background upload errors when applying gitignore rules', async () => {
    const file = new File(['content'], 'README.md');
    const filteredFile = new File(['content'], 'src/index.ts');
    const uploadError = new Error('upload failed');

    mockFilterFilesByGitignore.mockReturnValue([filteredFile]);
    mockUploadFolderWithStructure.mockRejectedValue(uploadError);

    const { result } = renderHook(() =>
      useUploadFolder({
        currentFolderId: 'fld_1',
        sourceSetId: 'sst_1',
        spaceId: 'spc_1',
        t: t as any,
        uploadFolderWithStructure: mockUploadFolderWithStructure,
      }),
    );

    await act(async () => {
      await result.current.handleFolderUpload({
        target: { files: [file], value: 'README.md' },
      } as any);
    });

    const confirmConfig = mockModalConfirm.mock.calls.at(-1)?.[0];
    expect(confirmConfig).toBeDefined();

    await act(async () => {
      await confirmConfig.onOk();
    });

    await waitFor(() => {
      expect(mockUploadFolderWithStructure).toHaveBeenCalledWith(
        [filteredFile],
        'sst_1',
        'fld_1',
        'spc_1',
      );
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to upload folder:', uploadError);
    });
  });
});
