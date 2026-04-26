/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CreateNewModelModal from './index';
import { ProviderSettingsContext } from '../ProviderSettingsContext';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockCreateNewAiModel = vi.hoisted(() => vi.fn());
const formInstance = vi.hoisted(() => ({
  getFieldsValue: vi.fn(() => ({ id: 'model-1', type: 'chat' })),
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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: any) =>
    selector({
      activeAiProvider: 'openai',
      createNewAiModel: mockCreateNewAiModel,
    }),
}));

vi.mock('./Form', () => ({
  default: ({ onFormInstanceReady }: any) => {
    onFormInstanceReady(formInstance);
    return <div>form</div>;
  },
}));

describe('CreateNewModelModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formInstance.validateFields.mockResolvedValue(undefined);
  });

  it('shows an error and clears loading when creating a model fails', async () => {
    mockCreateNewAiModel.mockRejectedValue(new Error('create failed'));

    render(
      <ProviderSettingsContext.Provider value={{ showDeployName: false }}>
        <CreateNewModelModal open setOpen={vi.fn()} />
      </ProviderSettingsContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'ok' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('providerModels.createNew.createError');
    });

    expect(screen.getByRole('button', { name: 'ok' })).toHaveAttribute('data-loading', 'false');
  });
});
