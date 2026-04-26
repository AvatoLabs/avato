import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { aiProviderService } from '@/services/aiProvider';

import { useAiInfraStore as useStore } from '../../../store';

vi.mock('zustand/traditional');

describe('AiProviderAction loading cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    act(() => {
      useStore.setState({
        activeAiProvider: 'openai',
        aiProviderConfigUpdatingIds: [],
        aiProviderDetailMap: {},
        aiProviderList: [{ enabled: false, id: 'openai', name: 'OpenAI' }] as any,
        aiProviderLoadingIds: [],
        aiProviderRuntimeConfig: {},
      });
    });
  });

  it('clears provider loading when toggleProviderEnabled fails', async () => {
    const { result } = renderHook(() => useStore());
    const toggleLoadingSpy = vi
      .spyOn(result.current, 'internal_toggleAiProviderLoading')
      .mockImplementation(() => {});
    vi.spyOn(aiProviderService, 'toggleProviderEnabled').mockRejectedValue(new Error('toggle'));

    await expect(async () => {
      await act(async () => {
        await result.current.toggleProviderEnabled('openai', true);
      });
    }).rejects.toThrow('toggle');

    expect(toggleLoadingSpy).toHaveBeenCalledWith('openai', true);
    expect(toggleLoadingSpy).toHaveBeenCalledWith('openai', false);
  });

  it('clears provider loading when updateAiProvider fails', async () => {
    const { result } = renderHook(() => useStore());
    const toggleLoadingSpy = vi
      .spyOn(result.current, 'internal_toggleAiProviderLoading')
      .mockImplementation(() => {});
    vi.spyOn(aiProviderService, 'updateAiProvider').mockRejectedValue(new Error('update'));

    await expect(async () => {
      await act(async () => {
        await result.current.updateAiProvider('openai', { name: 'OpenAI' });
      });
    }).rejects.toThrow('update');

    expect(toggleLoadingSpy).toHaveBeenCalledWith('openai', true);
    expect(toggleLoadingSpy).toHaveBeenCalledWith('openai', false);
  });

  it('clears provider config loading when updateAiProviderConfig fails', async () => {
    const { result } = renderHook(() => useStore());
    const toggleConfigLoadingSpy = vi
      .spyOn(result.current, 'internal_toggleAiProviderConfigUpdating')
      .mockImplementation(() => {});
    vi.spyOn(aiProviderService, 'updateAiProviderConfig').mockRejectedValue(new Error('config'));

    await expect(async () => {
      await act(async () => {
        await result.current.updateAiProviderConfig('openai', { fetchOnClient: true });
      });
    }).rejects.toThrow('config');

    expect(toggleConfigLoadingSpy).toHaveBeenCalledWith('openai', true);
    expect(toggleConfigLoadingSpy).toHaveBeenCalledWith('openai', false);
  });
});
