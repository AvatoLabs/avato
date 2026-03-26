import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useIsMobile } from '@/hooks/useIsMobile';
import { useAgentStore } from '@/store/agent/store';
import { ChatSettingsTabs } from '@/store/global/initialState';

import { useOpenChatSettings } from './useInterceptingRoutes';

const mockNavigate = vi.fn();
const mockUseNavigate = vi.fn(() => mockNavigate);
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockUseNavigate(),
}));
vi.mock('@/hooks/useIsMobile', () => ({
  useIsMobile: vi.fn(),
}));
vi.mock('@/store/global', () => ({
  useGlobalStore: {
    setState: vi.fn(),
  },
}));
describe('useOpenChatSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAgentStore.setState({
      activeAgentId: undefined,
      activeAgentSettingTab: undefined,
      showAgentSetting: false,
    });
  });

  it('navigates to mobile chat settings with session info', () => {
    useAgentStore.setState({ activeAgentId: '123' });
    vi.mocked(useIsMobile).mockReturnValue(true);
    const { result } = renderHook(() => useOpenChatSettings(ChatSettingsTabs.Meta));

    act(() => {
      result.current();
    });

    expect(mockNavigate).toHaveBeenCalledWith(
      `/chat/settings?session=123&showMobileWorkspace=true`,
    );
  });

  it('opens desktop agent settings overlay when not on mobile', () => {
    useAgentStore.setState({ activeAgentId: '456' });
    vi.mocked(useIsMobile).mockReturnValue(false);

    const { result } = renderHook(() => useOpenChatSettings(ChatSettingsTabs.Meta));

    act(() => {
      result.current();
    });

    expect(useAgentStore.getState().showAgentSetting).toBeTruthy();
    expect(useAgentStore.getState().activeAgentSettingTab).toBe(ChatSettingsTabs.Meta);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('stores the requested desktop settings tab', () => {
    useAgentStore.setState({ activeAgentId: '456' });
    vi.mocked(useIsMobile).mockReturnValue(false);

    const { result } = renderHook(() => useOpenChatSettings(ChatSettingsTabs.Knowledge));

    act(() => {
      result.current();
    });

    expect(useAgentStore.getState().showAgentSetting).toBeTruthy();
    expect(useAgentStore.getState().activeAgentSettingTab).toBe(ChatSettingsTabs.Knowledge);
  });
});
