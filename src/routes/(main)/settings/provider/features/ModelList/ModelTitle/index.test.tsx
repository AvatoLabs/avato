/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModelTitle from './index';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const aiInfraStoreState = vi.hoisted(() => ({
  clearModelsByProvider: vi.fn(),
  clearRemoteModels: vi.fn(),
  hasRemoteModels: true,
  isEmpty: false,
  searchKeyword: '',
  totalModels: 3,
  useFetchAiProviderModels: vi.fn(() => ({ isLoading: false })),
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick, title }: any) => (
    <button aria-label={title || 'action'} type="button" onClick={onClick} />
  ),
  DropdownMenu: ({ children, items }: any) => (
    <div>
      {children}
      {items?.map((item: any) => (
        <button key={item.key} type="button" onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Skeleton: {
    Button: () => <div>skeleton</div>,
  },
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
        success: mockMessageSuccess,
      },
      modal: {
        confirm: mockModalConfirm,
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
  useAiInfraStore: (selector: any) =>
    selector({
      clearModelsByProvider: aiInfraStoreState.clearModelsByProvider,
      clearRemoteModels: aiInfraStoreState.clearRemoteModels,
      modelSearchKeyword: aiInfraStoreState.searchKeyword,
      useFetchAiProviderModels: aiInfraStoreState.useFetchAiProviderModels,
    }),
}));

vi.mock('@/store/aiInfra/selectors', () => ({
  aiModelSelectors: {
    hasRemoteModels: () => aiInfraStoreState.hasRemoteModels,
    isEmptyAiProviderModelList: () => aiInfraStoreState.isEmpty,
    totalAiProviderModelList: () => aiInfraStoreState.totalModels,
  },
}));

vi.mock('../CreateNewModelModal', () => ({
  default: () => null,
}));

vi.mock('./Search', () => ({
  default: () => null,
}));

describe('ModelTitle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiInfraStoreState.hasRemoteModels = true;
    aiInfraStoreState.isEmpty = false;
    aiInfraStoreState.totalModels = 3;
  });

  it('shows an error when clearing fetched models fails', async () => {
    const error = new Error('clear fetched models failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.clearRemoteModels.mockRejectedValue(error);

    render(<ModelTitle provider="openai" />);

    fireEvent.click(screen.getByRole('button', { name: 'providerModels.list.fetcher.clear' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('providerModels.list.fetcher.clearError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to clear fetched models:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when resetting provider models fails', async () => {
    const error = new Error('reset models failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.clearModelsByProvider.mockRejectedValue(error);

    render(<ModelTitle provider="openai" />);

    fireEvent.click(screen.getByRole('button', { name: 'providerModels.list.resetAll.title' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('providerModels.list.resetAll.error');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to reset provider models:', error);

    consoleErrorSpy.mockRestore();
  });
});
