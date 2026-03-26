import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { useIsMobile } from '@/hooks/useIsMobile';
import { useAgentStore } from '@/store/agent/store';
import { ChatSettingsTabs } from '@/store/global/initialState';

export const useOpenChatSettings = (tab: ChatSettingsTabs = ChatSettingsTabs.Meta) => {
  const activeAgentId = useAgentStore((s) => s.activeAgentId);

  const isMobile = useIsMobile();
  const navigate = useNavigate();

  return useMemo(() => {
    if (isMobile)
      return () => navigate(`/chat/settings?session=${activeAgentId}&showMobileWorkspace=true`);

    return () => {
      useAgentStore.setState({ activeAgentSettingTab: tab, showAgentSetting: true });
    };
  }, [activeAgentId, navigate, tab, isMobile]);
};
