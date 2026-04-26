/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncTaskStatus } from '@/types/asyncTask';

import { GenerationItem } from './index';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockDownloadImage = vi.hoisted(() => vi.fn());
const imageStoreState = vi.hoisted(() => ({
  activeGenerationTopicId: 'topic-1',
  refreshGenerationBatches: vi.fn(),
  removeGeneration: vi.fn(),
  reuseSeed: vi.fn(),
  useCheckGenerationStatus: vi.fn(),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useDownloadImage', () => ({
  useDownloadImage: () => ({
    downloadImage: mockDownloadImage,
  }),
}));

vi.mock('@/store/image', () => ({
  useImageStore: (selector: any) => selector(imageStoreState),
}));

vi.mock('@/store/image/selectors', () => ({
  imageGenerationConfigSelectors: {
    isSupportedParam: () => () => false,
  },
}));

vi.mock('@/utils/client/resolveClientMediaUrl', () => ({
  resolveClientMediaUrl: (url: string) => url,
}));

vi.mock('@/utils/url', () => ({
  inferFileExtensionFromImageUrl: () => 'png',
}));

vi.mock('./ErrorState', () => ({
  ErrorState: ({ onDelete }: any) => (
    <button type="button" onClick={onDelete}>
      delete-generation
    </button>
  ),
}));

vi.mock('./LoadingState', () => ({
  LoadingState: ({ onDelete }: any) => (
    <button type="button" onClick={onDelete}>
      delete-generation
    </button>
  ),
}));

vi.mock('./SuccessState', () => ({
  SuccessState: ({ onDelete, onDownload }: any) => (
    <div>
      <button type="button" onClick={onDelete}>
        delete-generation
      </button>
      <button type="button" onClick={onDownload}>
        download-image
      </button>
    </div>
  ),
}));

vi.mock('./utils', () => ({
  getAspectRatio: () => '1',
}));

describe('GenerationItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting an image fails', async () => {
    const error = new Error('delete image failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    imageStoreState.removeGeneration.mockRejectedValue(error);

    render(
      <GenerationItem
        generation={
          {
            id: 'gen-1',
            task: { id: 'task-1', status: AsyncTaskStatus.Pending },
          } as any
        }
        generationBatch={{ id: 'batch-1' } as any}
        prompt="a scenic landscape"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete-generation' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('generation.actions.deleteFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete generation:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when downloading an image fails', async () => {
    const error = new Error('download image failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDownloadImage.mockRejectedValue(error);

    render(
      <GenerationItem
        generation={
          {
            asset: { url: 'https://example.com/image.png' },
            createdAt: '2026-04-08T00:00:00.000Z',
            fileId: 'file-1',
            id: 'gen-1',
            task: { id: 'task-1', status: AsyncTaskStatus.Success },
          } as any
        }
        generationBatch={{ id: 'batch-1' } as any}
        prompt="a scenic landscape"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'download-image' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('generation.actions.downloadFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to download image:', error);

    consoleErrorSpy.mockRestore();
  });
});
