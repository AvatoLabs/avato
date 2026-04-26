/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SearchResult from './SearchResult';

const aiInfraStoreState = vi.hoisted(() => ({
  aiProviderList: [
    { description: 'OpenAI provider', id: 'openai', name: 'OpenAI' },
  ],
  providerSearchKeyword: 'open',
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: any) => selector(aiInfraStoreState),
}));

vi.mock('./Item', () => ({
  default: ({ id, name }: any) => <div>{`${name}:${id}`}</div>,
}));

describe('ProviderMenu SearchResult', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiInfraStoreState.providerSearchKeyword = 'open';
    aiInfraStoreState.aiProviderList = [
      { description: 'OpenAI provider', id: 'openai', name: 'OpenAI' },
    ];
  });

  it('recomputes results when the provider list changes under the same keyword', () => {
    const { rerender } = render(<SearchResult onProviderSelect={vi.fn()} />);

    expect(screen.getByText('OpenAI:openai')).toBeInTheDocument();

    aiInfraStoreState.aiProviderList = [
      { description: 'OpenRouter provider', id: 'openrouter', name: 'OpenRouter' },
    ];

    rerender(<SearchResult onProviderSelect={vi.fn()} />);

    expect(screen.getByText('OpenRouter:openrouter')).toBeInTheDocument();
    expect(screen.queryByText('OpenAI:openai')).not.toBeInTheDocument();
  });
});
