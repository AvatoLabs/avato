/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModelItem from './ModelItem';
import { ProviderSettingsContext } from './ProviderSettingsContext';

const mockCopyToClipboard = vi.hoisted(() => vi.fn());
const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const aiInfraStoreState = vi.hoisted(() => ({
  activeAiProvider: 'openai',
  isModelLoading: false,
  removeAiModel: vi.fn(),
  toggleModelEnabled: vi.fn(),
}));

vi.mock('@lobehub/icons', () => ({
  ModelIcon: () => null,
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick, title }: any) => (
    <button aria-label={title || 'action'} type="button" onClick={onClick} />
  ),
  copyToClipboard: mockCopyToClipboard,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Tag: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
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
  Switch: ({ checked, onChange }: any) => (
    <button aria-label="toggle-model" type="button" onClick={() => onChange?.(!checked)}>
      {checked ? 'on' : 'off'}
    </button>
  ),
}));

vi.mock('antd-style', () => ({
  createStaticStyles: (factory: any) =>
    factory({
      css: () => '',
      cssVar: {
        borderRadiusLG: '8px',
        colorFillTertiary: '',
        colorTextSecondary: '',
      },
      cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
    }),
  cssVar: {
    colorTextSecondary: '',
  },
}));

vi.mock('model-bank', () => ({
  AiModelSourceEnum: {
    Builtin: 'builtin',
    Custom: 'custom',
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ModelSelect', () => ({
  ModelInfoTags: () => null,
}));

vi.mock('@/components/ModelSelect/NewModelBadge', () => ({
  default: () => null,
}));

vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/store/aiInfra', () => ({
  aiModelSelectors: {
    isModelLoading: () => () => aiInfraStoreState.isModelLoading,
  },
  useAiInfraStore: (selector: any) => selector(aiInfraStoreState),
}));

vi.mock('@/utils/format', () => ({
  formatPriceByCurrency: () => '$0.01',
}));

vi.mock('@/utils/pricing', () => ({
  getAudioInputUnitRate: () => undefined,
  getTextInputUnitRate: () => undefined,
  getTextOutputUnitRate: () => undefined,
}));

vi.mock('./ModelConfigModal', () => ({
  default: () => null,
}));

const renderModelItem = (props?: Record<string, unknown>) =>
  render(
    <ProviderSettingsContext value={{ modelEditable: true }}>
      <ModelItem
        {...({
          abilities: {},
          contextWindowTokens: 128000,
          displayName: 'GPT Test',
          enabled: false,
          id: 'gpt-test',
          source: 'builtin',
          type: 'chat',
          ...props,
        } as any)}
      />
    </ProviderSettingsContext>,
  );

describe('ModelItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiInfraStoreState.isModelLoading = false;
  });

  it('shows an error when copying a model id fails', async () => {
    const error = new Error('copy failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockCopyToClipboard.mockRejectedValue(error);

    renderModelItem();

    fireEvent.click(screen.getByRole('button', { name: 'gpt-test' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith({ content: 'copyFail' });
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy model id:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when deleting a model fails', async () => {
    const error = new Error('delete failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.removeAiModel.mockRejectedValue(error);

    renderModelItem({ source: 'custom' });

    fireEvent.click(screen.getByRole('button', { name: 'providerModels.item.delete.title' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('providerModels.item.delete.error');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete model:', error);

    consoleErrorSpy.mockRestore();
  });

  it('reverts the switch when updating model state fails', async () => {
    const error = new Error('toggle failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.toggleModelEnabled.mockRejectedValue(error);

    renderModelItem({ enabled: false });

    expect(screen.getByRole('button', { name: 'toggle-model' })).toHaveTextContent('off');

    fireEvent.click(screen.getByRole('button', { name: 'toggle-model' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('providerModels.item.toggleError');
    });

    expect(screen.getByRole('button', { name: 'toggle-model' })).toHaveTextContent('off');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update model enabled state:', error);

    consoleErrorSpy.mockRestore();
  });
});
