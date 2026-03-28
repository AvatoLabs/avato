'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import ActionBar from '../ActionBar';
import AgentCronJobs from '../AgentCronJobs';
import AgentSettings from '../AgentSettings';
import CapabilityCard from '../CapabilityCard';
import IdentityCard from '../IdentityCard';
import PromptSection from '../PromptSection';

const ProfileEditor = memo(() => {
  return (
    <Flexbox
      flex={1}
      gap={0}
      style={{
        cursor: 'default',
        height: '100%',
        overflow: 'auto',
        padding: '0 0 24px',
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {/* Identity Section: Avatar + Name + Description */}
      <IdentityCard />

      {/* Capability Section: Model + Tools + Knowledge */}
      <CapabilityCard />

      {/* Prompt Editor Section */}
      <PromptSection />

      {/* Action Bar: Start Chat + Publish + Cron Jobs */}
      <ActionBar />

      {/* Agent Cron Jobs Display (only show if jobs exist) */}
      <AgentCronJobs />

      {/* Advanced Settings Modal */}
      <AgentSettings />
    </Flexbox>
  );
});

export default ProfileEditor;
