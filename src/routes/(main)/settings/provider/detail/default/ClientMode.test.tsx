/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ClientMode from './ClientMode';

const mockMutate = vi.hoisted(() => vi.fn());
const swrState = vi.hoisted(() => ({
  data: undefined as any,
  error: undefined as any,
  isLoading: false,
}));
const aiInfraStoreState = vi.hoisted(() => ({
  setActiveAiProvider: vi.fn(),
  useFetchAiProviderItem: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Center: ({ children }: any) => <div>{children}</div>,
  Empty: ({ action, description }: any) => (
    <div>
      <div>{description}</div>
      {action}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: () => <div>loading</div>,
}));

vi.mock('@/libs/swr', () => ({
  useClientDataSWR: () => ({
    data: swrState.data,
    error: swrState.error,
    isLoading: swrState.isLoading,
    mutate: mockMutate,
  }),
}));

vi.mock('@/services/aiProvider', () => ({
  aiProviderService: {
    getAiProviderById: vi.fn(),
  },
}));

vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: any) => selector(aiInfraStoreState),
}));

vi.mock('../../features/ModelList', () => ({
  default: () => <div>model-list</div>,
}));

vi.mock('../../features/ProviderConfig', () => ({
  default: () => <div>provider-config</div>,
}));

describe('ClientMode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    swrState.data = undefined;
    swrState.error = undefined;
    swrState.isLoading = false;
  });

  it('shows a retryable load error when fetching provider details fails', () => {
    swrState.error = new Error('load failed');

    render(<ClientMode id="custom-provider" />);

    expect(screen.getByText('detail.loadError')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'retry' }));

    expect(mockMutate).toHaveBeenCalled();
  });

  it('shows a not-found state when provider details are missing', () => {
    render(<ClientMode id="missing-provider" />);

    expect(screen.getByText('detail.notFound')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'retry' })).not.toBeInTheDocument();
  });
});
