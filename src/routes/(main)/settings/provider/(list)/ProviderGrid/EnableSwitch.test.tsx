/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EnableSwitch from './EnableSwitch';

const mockMessageError = vi.hoisted(() => vi.fn());
const providerState = vi.hoisted(() => ({
  toggleProviderEnabled: vi.fn(),
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

vi.mock('@/components/InstantSwitch', () => ({
  default: ({ enabled, onChange }: any) => (
    <button
      aria-checked={enabled ? 'true' : 'false'}
      type="button"
      onClick={() => {
        void onChange(!enabled).catch(() => {});
      }}
    >
      toggle-provider-grid
    </button>
  ),
}));

vi.mock('@/store/aiInfra', () => ({
  useAiInfraStore: (selector: any) =>
    selector({
      toggleProviderEnabled: providerState.toggleProviderEnabled,
    }),
}));

describe('ProviderGrid EnableSwitch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when toggling provider fails', async () => {
    const error = new Error('toggle provider failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    providerState.toggleProviderEnabled.mockRejectedValue(error);

    render(<EnableSwitch enabled={false} id="openai" />);

    fireEvent.click(screen.getByRole('button', { name: 'toggle-provider-grid' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('updateAiProvider.toggleError');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to update provider enabled state:', error);
    consoleErrorSpy.mockRestore();
  });
});
