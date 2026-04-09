/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncTaskStatus } from '@/types/asyncTask';

import { GenerationBatchItem } from './BatchItem';

const mockMessageError = vi.hoisted(() => vi.fn());
const imageStoreState = vi.hoisted(() => ({
  activeGenerationTopicId: 'topic-1',
  recreateImage: vi.fn(),
  removeGenerationBatch: vi.fn(),
  reuseSettings: vi.fn(),
}));

vi.mock('@formkit/auto-animate/react', () => ({
  useAutoAnimate: () => [null],
}));

vi.mock('@lobehub/icons', () => ({
  ModelTag: () => null,
}));

vi.mock('@lobehub/ui', () => ({
  ActionIconGroup: ({ items }: any) => (
    <div>
      {items?.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  Block: ({ children }: any) => <div>{children}</div>,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Grid: ({ children }: any) => <div>{children}</div>,
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

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    batchActions: '',
    batchDeleteButton: '',
    container: '',
    prompt: '',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/business/client/hooks/useRenderBusinessBatchItem', () => ({
  default: () => ({
    businessBatchItem: null,
    shouldRenderBusinessBatchItem: false,
  }),
}));

vi.mock('@/components/InvalidAPIKey', () => ({
  default: () => null,
}));

vi.mock('@/store/image', () => ({
  useImageStore: (selector: any) => selector(imageStoreState),
}));

vi.mock('./GenerationItem', () => ({
  GenerationItem: () => null,
}));

vi.mock('./GenerationItem/utils', () => ({
  DEFAULT_MAX_ITEM_WIDTH: 320,
}));

vi.mock('./ReferenceImages', () => ({
  ReferenceImages: () => null,
}));

describe('GenerationBatchItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when deleting a batch fails', async () => {
    const error = new Error('delete batch failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    imageStoreState.removeGenerationBatch.mockRejectedValue(error);

    render(
      <GenerationBatchItem
        batch={
          {
            config: {},
            createdAt: '2026-04-08T00:00:00.000Z',
            generations: [{ id: 'gen-1', task: { status: AsyncTaskStatus.Success } }],
            id: 'batch-1',
            model: 'gpt-image-1',
            prompt: 'a scenic landscape',
            provider: 'openai',
          } as any
        }
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'generation.actions.deleteBatch' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('generation.actions.deleteBatchFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete batch:', error);

    consoleErrorSpy.mockRestore();
  });
});
