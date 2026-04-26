'use client';

import { Modal } from '@lobehub/ui';
import { memo } from 'react';

import { useAgentStore } from '@/store/agent/store';

import Content from './Content';

const AgentSettings = memo(() => {
  const showAgentSetting = useAgentStore((s) => s.showAgentSetting);

  return (
    <Modal
      centered
      footer={null}
      open={showAgentSetting}
      title={null}
      width={960}
      styles={{
        body: {
          height: '60vh',
          overflow: 'scroll',
          padding: 0,
          position: 'relative',
        },
      }}
      onCancel={() =>
        useAgentStore.setState({ activeAgentSettingTab: undefined, showAgentSetting: false })
      }
    >
      <Content />
    </Modal>
  );
});

export default AgentSettings;
