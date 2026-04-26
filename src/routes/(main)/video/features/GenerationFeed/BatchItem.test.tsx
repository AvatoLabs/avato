/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncTaskStatus } from '@/types/asyncTask';

import { VideoGenerationBatchItem } from './BatchItem';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockDownloadFile = vi.hoisted(() => vi.fn());
const videoStoreState = vi.hoisted(() => ({
  activeGenerationTopicId: 'topic-1',
  removeGeneration: vi.fn(),
  useCheckGenerationStatus: vi.fn(),
}));

vi.mock('@lobehub/icons', () => ({
  ModelTag: () => null,
}));

vi.mock('@lobehub/ui', () => ({
  Block: ({ children }: any) => <div>{children}</div>,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Markdown: ({ children }: any) => <div>{children}</div>,
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
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

vi.mock('@/business/client/hooks/useRenderBusinessVideoBatchItem', () => ({
  default: () => ({
    businessBatchItem: null,
    shouldRenderBusinessBatchItem: false,
  }),
}));

vi.mock('@/store/video', () => ({
  useVideoStore: (selector: any) => selector(videoStoreState),
}));

vi.mock('@/utils/client/downloadFile', () => ({
  downloadFile: mockDownloadFile,
}));

vi.mock('./VideoErrorItem', () => ({
  default: ({ onDelete }: any) => (
    <button type="button" onClick={onDelete}>
      delete-video
    </button>
  ),
}));

vi.mock('./VideoLoadingItem', () => ({
  default: ({ onDelete }: any) => (
    <button type="button" onClick={onDelete}>
      delete-video
    </button>
  ),
}));

vi.mock('./VideoReferenceFrames', () => ({
  default: () => null,
}));

vi.mock('./VideoSuccessItem', () => ({
  default: ({ onDelete, onDownload }: any) => (
    <div>
      <button type="button" onClick={onDelete}>
        delete-video
      </button>
      <button type="button" onClick={onDownload}>
        download-video
      </button>
    </div>
  ),
}));

describe('VideoGenerationBatchItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting a video fails', async () => {
    const error = new Error('delete video failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    videoStoreState.removeGeneration.mockRejectedValue(error);

    render(
      <VideoGenerationBatchItem
        batch={
          {
            config: {},
            createdAt: '2026-04-08T00:00:00.000Z',
            generations: [{ id: 'video-1', task: { id: 'task-1', status: AsyncTaskStatus.Error } }],
            model: 'veo-3',
            prompt: 'a cinematic drone shot',
          } as any
        }
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete-video' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('generation.actions.deleteFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete generation:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when downloading a video fails', async () => {
    const error = new Error('download video failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDownloadFile.mockRejectedValue(error);

    render(
      <VideoGenerationBatchItem
        batch={
          {
            config: {},
            createdAt: '2026-04-08T00:00:00.000Z',
            generations: [
              {
                asset: { url: 'https://example.com/video.mp4' },
                createdAt: '2026-04-08T00:00:00.000Z',
                id: 'video-1',
                task: { id: 'task-1', status: AsyncTaskStatus.Success },
              },
            ],
            model: 'veo-3',
            prompt: 'a cinematic drone shot',
          } as any
        }
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'download-video' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('generation.actions.downloadFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to download video:', error);

    consoleErrorSpy.mockRestore();
  });
});
