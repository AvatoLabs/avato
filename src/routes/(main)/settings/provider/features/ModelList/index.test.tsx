/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModelList from './index';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockFetchRemoteModelList = vi.hoisted(() => vi.fn());
const aiInfraStoreState = vi.hoisted(() => ({
  fetchRemoteModelList: mockFetchRemoteModelList,
  modelSearchKeyword: '',
  useFetchAiProviderModels: vi.fn(() => ({ isLoading: true })),
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  Tabs: () => null,
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
  cssVar: {
    colorBgContainer: '',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/store/aiInfra', () => ({
  aiModelSelectors: {
    filteredAiProviderModelList: () => [],
    isEmptyAiProviderModelList: () => false,
  },
  useAiInfraStore: (selector: any) => selector(aiInfraStoreState),
}));

vi.mock('./DisabledModels', () => ({
  default: () => null,
}));

vi.mock('./EmptyModels', () => ({
  default: () => null,
}));

vi.mock('./EnabledModelList', () => ({
  default: () => null,
}));

vi.mock('./ModelTitle', () => ({
  default: ({ onFetchRemoteModels }: any) => (
    <button type="button" onClick={onFetchRemoteModels}>
      fetch-remote-models
    </button>
  ),
}));

vi.mock('./SearchResult', () => ({
  default: () => null,
}));

vi.mock('./SkeletonList', () => ({
  default: () => null,
}));

describe('ModelList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when fetching remote models fails', async () => {
    const error = new Error('fetch models failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockFetchRemoteModelList.mockRejectedValue(error);

    render(<ModelList id="openai" />);

    fireEvent.click(screen.getByRole('button', { name: 'fetch-remote-models' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('providerModels.list.fetcher.fetchError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch remote models:', error);

    consoleErrorSpy.mockRestore();
  });
});
