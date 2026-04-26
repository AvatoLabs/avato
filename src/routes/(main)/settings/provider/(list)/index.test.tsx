/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProviderPage from './index';

const setSearchParams = vi.hoisted(() => vi.fn());
const searchParamsState = vi.hoisted(() => ({
  provider: 'openai',
}));

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [
    {
      get: (key: string) => {
        if (key === 'provider') return searchParamsState.provider;
        return null;
      },
    },
    setSearchParams,
  ],
}));

vi.mock('@/const/version', () => ({
  isCustomBranding: false,
}));

vi.mock('../_layout/Desktop', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../_layout/Mobile', () => ({
  default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../detail', () => ({
  default: ({ id }: any) => <div>{`provider-detail:${id}`}</div>,
}));

vi.mock('./Footer', () => ({
  default: () => <div>provider-footer</div>,
}));

describe('settings/provider legacy list page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsState.provider = 'openai';
  });

  it('tracks provider id directly from search params on rerender', () => {
    const { rerender } = render(<ProviderPage />);

    expect(screen.getByText('provider-detail:openai')).toBeInTheDocument();

    searchParamsState.provider = 'ollama';
    rerender(<ProviderPage />);

    expect(screen.getByText('provider-detail:ollama')).toBeInTheDocument();
    expect(screen.queryByText('provider-detail:openai')).not.toBeInTheDocument();
  });
});
