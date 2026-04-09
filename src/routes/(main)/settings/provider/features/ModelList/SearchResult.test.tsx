/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SearchResult from './SearchResult';

const mockMessageError = vi.hoisted(() => vi.fn());
const aiInfraStoreState = vi.hoisted(() => ({
  batchToggleAiModels: vi.fn(),
  filteredModels: [
    {
      displayName: 'GPT-4o',
      enabled: false,
      id: 'gpt-4o',
    },
  ],
  modelSearchKeyword: 'gpt',
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

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ loading, onClick, title }: any) => (
    <button
      aria-label={title}
      data-loading={loading ? 'true' : 'false'}
      type="button"
      onClick={() => {
        void onClick();
      }}
    />
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
  TooltipGroup: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => (opts?.count ? `${key}:${opts.count}` : key),
  }),
}));

vi.mock('@/store/aiInfra', () => ({
  aiModelSelectors: {
    filteredAiProviderModelList: (s: any) => s.filteredModels,
  },
  useAiInfraStore: (selector: any) =>
    selector({
      batchToggleAiModels: aiInfraStoreState.batchToggleAiModels,
      filteredModels: aiInfraStoreState.filteredModels,
      modelSearchKeyword: aiInfraStoreState.modelSearchKeyword,
    }),
}));

vi.mock('./ModelItem', () => ({
  default: () => null,
}));

describe('SearchResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and resets loading when batch enable fails', async () => {
    const error = new Error('batch enable failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.batchToggleAiModels.mockRejectedValue(error);

    render(<SearchResult />);

    fireEvent.click(
      screen.getByRole('button', { name: 'providerModels.list.enabledActions.enableAll' }),
    );

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith(
        'providerModels.list.enabledActions.toggleError',
      );
      expect(
        screen.getByRole('button', { name: 'providerModels.list.enabledActions.enableAll' }),
      ).toHaveAttribute('data-loading', 'false');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to batch update model enabled states:',
      error,
    );
    consoleErrorSpy.mockRestore();
  });
});
