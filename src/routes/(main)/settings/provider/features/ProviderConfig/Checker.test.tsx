/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Checker from './Checker';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockFetchPresetTaskResult = vi.hoisted(() => vi.fn());
const aiInfraStoreState = vi.hoisted(() => ({
  aiProviderModelList: [
    { enabled: true, id: 'gpt-4o', type: 'chat' },
    { enabled: false, id: 'gpt-4.1', type: 'chat' },
  ],
  isProviderConfigUpdating: false,
  updateAiProviderConfig: vi.fn(),
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

vi.mock('@ant-design/icons', () => ({
  CheckCircleFilled: () => null,
}));

vi.mock('@lobehub/icons', () => ({
  ModelIcon: () => null,
}));

vi.mock('@lobehub/ui', () => ({
  Alert: ({ title }: any) => <div>{title}</div>,
  Button: ({ children, onClick }: any) => (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
    >
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Highlighter: ({ children }: any) => <pre>{children}</pre>,
  Icon: () => null,
}));

vi.mock('@lobehub/ui/base-ui', () => ({
  Select: ({ onSelect, options, value }: any) => {
    const nextValue = options.find((item: any) => item.value !== value)?.value ?? value;
    return (
      <button
        data-value={value}
        type="button"
        onClick={() => {
          void onSelect(nextValue);
        }}
      >
        select-check-model
      </button>
    );
  },
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    popup: 'popup',
  }),
  cssVar: {
    colorSuccess: '#00aa00',
  },
  cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/services/chat', () => ({
  chatService: {
    fetchPresetTaskResult: mockFetchPresetTaskResult,
  },
}));

vi.mock('@/hooks/useProviderName', () => ({
  useProviderName: () => 'OpenAI',
}));

vi.mock('@/store/aiInfra', () => ({
  aiProviderSelectors: {
    isProviderConfigUpdating: () => () => aiInfraStoreState.isProviderConfigUpdating,
  },
  useAiInfraStore: (selector: any) => selector(aiInfraStoreState),
}));

describe('Checker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiInfraStoreState.isProviderConfigUpdating = false;
  });

  it('reverts the checker model and shows an error when saving fails', async () => {
    const error = new Error('save checker model failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.updateAiProviderConfig.mockRejectedValue(error);

    render(
      <Checker
        model="gpt-4o"
        provider="openai"
        onAfterCheck={vi.fn().mockResolvedValue(undefined)}
        onBeforeCheck={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'select-check-model' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('providerModels.config.checker.updateError');
      expect(screen.getByRole('button', { name: 'select-check-model' })).toHaveAttribute(
        'data-value',
        'gpt-4o',
      );
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to update connection checker model:',
      error,
    );

    consoleErrorSpy.mockRestore();
  });

  it('always calls onAfterCheck when onBeforeCheck fails', async () => {
    const error = new Error('prepare failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onBeforeCheck = vi.fn().mockRejectedValue(error);
    const onAfterCheck = vi.fn().mockResolvedValue(undefined);

    render(
      <Checker
        model="gpt-4o"
        provider="openai"
        onAfterCheck={onAfterCheck}
        onBeforeCheck={onBeforeCheck}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'llm.checker.button' }));

    await waitFor(() => {
      expect(onAfterCheck).toHaveBeenCalled();
    });

    expect(mockFetchPresetTaskResult).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to run provider connection check:', error);

    consoleErrorSpy.mockRestore();
  });
});
