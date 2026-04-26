/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ModelConfigModal from './index';
import { ProviderSettingsContext } from '../ProviderSettingsContext';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockUpdateAiModelsConfig = vi.hoisted(() => vi.fn());
const formInstance = vi.hoisted(() => ({
  getFieldsValue: vi.fn(() => ({ enabled: true })),
  validateFields: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, loading, onClick }: any) => (
    <button data-loading={loading ? 'true' : 'false'} type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Modal: ({ children, footer, open }: any) => (open ? <div>{children}{footer}</div> : null),
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

vi.mock('fast-deep-equal', () => ({
  default: () => false,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/aiInfra', () => ({
  aiModelSelectors: {
    getAiModelById: () => () => ({ id: 'model-1', type: 'chat' }),
  },
  useAiInfraStore: (selector: any) =>
    selector({
      activeAiProvider: 'openai',
      updateAiModelsConfig: mockUpdateAiModelsConfig,
    }),
}));

vi.mock('../CreateNewModelModal/Form', () => ({
  default: ({ onFormInstanceReady }: any) => {
    onFormInstanceReady(formInstance);
    return <div>form</div>;
  },
}));

describe('ModelConfigModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formInstance.validateFields.mockResolvedValue(undefined);
  });

  it('shows an error and clears loading when updating a model config fails', async () => {
    mockUpdateAiModelsConfig.mockRejectedValue(new Error('update failed'));

    render(
      <ProviderSettingsContext.Provider value={{ showDeployName: false }}>
        <ModelConfigModal id="model-1" open setOpen={vi.fn()} />
      </ProviderSettingsContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith(
        'providerModels.item.modelConfig.updateError',
      );
    });

    expect(screen.getByRole('button', { name: 'ok' })).toHaveAttribute('data-loading', 'false');
  });
});
