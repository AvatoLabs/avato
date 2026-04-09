/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CreateNewProvider from './index';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockNavigate = vi.hoisted(() => vi.fn());
const aiInfraStoreState = vi.hoisted(() => ({
  createNewAiProvider: vi.fn(),
}));

vi.mock('@lobehub/icons', () => ({
  ProviderIcon: () => null,
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
  FormModal: ({ onFinish }: any) => (
    <button
      type="button"
      onClick={() =>
        onFinish?.({
          id: 'provider-1',
          name: 'Provider 1',
          settings: { sdkType: 'openai' },
        })
      }
    >
      submit-form
    </button>
  ),
  Icon: () => null,
  Input: () => null,
  InputPassword: () => null,
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

describe('CreateNewProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when creating a provider fails', async () => {
    const error = new Error('create provider failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    aiInfraStoreState.createNewAiProvider.mockRejectedValue(error);

    render(<CreateNewProvider open />);

    fireEvent.click(screen.getByRole('button', { name: 'submit-form' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('createNewAiProvider.createError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to create AI provider:', error);
    expect(mockNavigate).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
