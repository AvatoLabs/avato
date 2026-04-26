/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EnabledModelList from './index';

const mockMessageError = vi.hoisted(() => vi.fn());
const aiInfraStoreState = vi.hoisted(() => ({
  batchToggleAiModels: vi.fn(),
  enabledModels: [
    {
      displayName: 'GPT-4o',
      enabled: true,
      id: 'gpt-4o',
      type: 'chat',
    },
  ],
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
  Center: ({ children }: any) => <div>{children}</div>,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
  TooltipGroup: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: any) =>
    selector({
      batchToggleAiModels: aiInfraStoreState.batchToggleAiModels,
      enabledModels: aiInfraStoreState.enabledModels,
    }),
}));

vi.mock('@/store/aiInfra/selectors', () => ({
  aiModelSelectors: {
    enabledAiProviderModelList: (s: any) => s.enabledModels,
  },
}));

vi.mock('../ModelItem', () => ({
  default: () => null,
}));

vi.mock('../SortModelModal', () => ({
  default: () => null,
}));

describe('EnabledModelList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and resets loading when batch disable fails', async () => {
    const error = new Error('batch disable failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.batchToggleAiModels.mockRejectedValue(error);

    render(<EnabledModelList activeTab="all" />);

    fireEvent.click(
      screen.getByRole('button', { name: 'providerModels.list.enabledActions.disableAll' }),
    );

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith(
        'providerModels.list.enabledActions.toggleError',
      );
      expect(
        screen.getByRole('button', { name: 'providerModels.list.enabledActions.disableAll' }),
      ).toHaveAttribute('data-loading', 'false');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to batch update model enabled states:',
      error,
    );
    consoleErrorSpy.mockRestore();
  });
});
