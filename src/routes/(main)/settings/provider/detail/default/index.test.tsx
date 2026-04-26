/**
 * @vitest-environment happy-dom
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProviderDetail from './index';

const aiInfraStoreState = vi.hoisted(() => ({
  setActiveAiProvider: vi.fn(),
  useFetchAiProviderItem: vi.fn(),
  useFetchAiProviderList: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: any) => selector(aiInfraStoreState),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) => selector({ isMobile: false }),
}));

vi.mock('../../features/ModelList', () => ({
  default: () => <div>model-list</div>,
}));

vi.mock('../../features/ProviderConfig', () => ({
  default: () => <div>provider-config</div>,
}));

describe('ProviderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets the active provider immediately on mount', () => {
    render(
      <ProviderDetail
        enabled={true}
        id="openai"
        name="OpenAI"
        settings={{}}
        source={'builtin' as any}
      />,
    );

    expect(aiInfraStoreState.setActiveAiProvider).toHaveBeenCalledWith('openai');
  });
});
