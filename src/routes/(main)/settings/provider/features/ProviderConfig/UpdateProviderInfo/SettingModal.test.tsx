/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SettingModal from './SettingModal';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const aiInfraStoreState = vi.hoisted(() => ({
  deleteAiProvider: vi.fn(),
  updateAiProvider: vi.fn(),
}));

vi.mock('@lobehub/icons', () => ({
  ProviderIcon: () => null,
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  FormModal: ({ footer, onFinish }: any) => (
    <div>
      {footer}
      <button
        type="button"
        onClick={() => onFinish?.({ description: 'Updated provider', name: 'Updated Provider' })}
      >
        submit-form
      </button>
    </div>
  ),
  Icon: () => null,
  Input: () => null,
  Select: () => null,
  TextArea: () => null,
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/store/aiInfra/store', () => ({
  useAiInfraStore: (selector: any) => selector(aiInfraStoreState),
}));

vi.mock('../../customProviderSdkOptions', () => ({
  CUSTOM_PROVIDER_SDK_OPTIONS: [],
}));

describe('UpdateProviderInfo SettingModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when updating a provider fails', async () => {
    const error = new Error('update provider failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.updateAiProvider.mockRejectedValue(error);

    render(
      <SettingModal
        id="provider-1"
        initialValues={{ id: 'provider-1', name: 'Provider 1', settings: {} } as any}
        open
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'submit-form' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('updateAiProvider.updateError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update AI provider:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error when deleting a provider fails', async () => {
    const error = new Error('delete provider failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.deleteAiProvider.mockRejectedValue(error);

    render(
      <SettingModal
        id="provider-1"
        initialValues={{ id: 'provider-1', name: 'Provider 1', settings: {} } as any}
        open
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'delete' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('updateAiProvider.deleteError');
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to delete AI provider:', error);

    consoleErrorSpy.mockRestore();
  });
});
