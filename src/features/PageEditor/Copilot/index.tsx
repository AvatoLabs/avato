'use client';

import Loading from '@/components/Loading/BrandTextLoading';
import { memo } from 'react';
import { Center } from '@lobehub/ui';

import RightPanel from '@/features/RightPanel';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';

import Conversation from './Conversation';

/**
 * Help write, read, and edit the page
 */
const Copilot = memo<{ loading?: boolean }>(({ loading = false }) => {
  const [width, updateSystemStatus] = useGlobalStore((s) => [
    systemStatusSelectors.docsAgentPanelWidth(s),
    s.updateSystemStatus,
  ]);

  return (
    <RightPanel
      defaultWidth={width}
      onSizeChange={(size) => {
        if (size?.width) {
          const w = typeof size.width === 'string' ? Number.parseInt(size.width) : size.width;
          if (!!w) updateSystemStatus({ docsAgentPanelWidth: w });
        }
      }}
    >
      {loading ? (
        <Center height={'100%'}>
          <Loading debugId="DocsAgentProvider" />
        </Center>
      ) : (
        <Conversation />
      )}
    </RightPanel>
  );
});

export default Copilot;
