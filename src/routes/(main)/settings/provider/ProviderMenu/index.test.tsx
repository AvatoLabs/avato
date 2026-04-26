/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProviderMenu from './index';

const aiInfraStoreState = vi.hoisted(() => ({
  initAiProviderList: true,
  providerSearchKeyword: 'open',
  useFetchAiProviderList: vi.fn(),
}));

const setAiInfraStoreState = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  SearchBar: ({ onChange, value }: any) => (
    <input
      aria-label="provider-search"
      value={value}
      onChange={(e) => onChange?.(e)}
    />
  ),
}));

vi.mock('antd-style', () => ({
  cssVar: {
    colorBgContainer: '#fff',
    colorBorderSecondary: '#eee',
    colorTextDescription: '#999',
  },
}));

vi.mock('lucide-react', () => ({
  SearchIcon: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/features/NavPanel/components/SkeletonList', () => ({
  default: () => <div>skeleton-list</div>,
}));

vi.mock('@/store/aiInfra/store', () => {
  const useAiInfraStore = (selector: any) => selector(aiInfraStoreState);
  useAiInfraStore.setState = setAiInfraStoreState;
  return { useAiInfraStore };
});

vi.mock('./AddNew', () => ({
  default: () => <div>add-new</div>,
}));

vi.mock('./List', () => ({
  default: () => <div>provider-list</div>,
}));

vi.mock('./SearchResult', () => ({
  default: () => <div>provider-search-result</div>,
}));

describe('ProviderMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    aiInfraStoreState.initAiProviderList = true;
    aiInfraStoreState.providerSearchKeyword = 'open';
  });

  it('keeps the search input synced with store updates', () => {
    const { rerender } = render(<ProviderMenu onProviderSelect={vi.fn()} />);

    expect(screen.getByLabelText('provider-search')).toHaveValue('open');

    aiInfraStoreState.providerSearchKeyword = 'ollama';
    rerender(<ProviderMenu onProviderSelect={vi.fn()} />);

    expect(screen.getByLabelText('provider-search')).toHaveValue('ollama');
  });

  it('writes typing changes back to the store immediately', () => {
    render(<ProviderMenu onProviderSelect={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('provider-search'), {
      target: { value: 'vertex' },
    });

    expect(setAiInfraStoreState).toHaveBeenCalledWith({ providerSearchKeyword: 'vertex' });
  });
});
