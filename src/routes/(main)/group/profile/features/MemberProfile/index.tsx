'use client';

import { Alert, Flexbox, Icon } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { InfoIcon } from 'lucide-react';
import React, { memo, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useAgentGroupStore } from '@/store/agentGroup';
import { agentGroupSelectors } from '@/store/agentGroup/selectors';
import { useGroupProfileStore } from '@/store/groupProfile';

import AutoSaveHint from '../Header/AutoSaveHint';
import ActionBar from './ActionBar';
import CapabilityCard from './CapabilityCard';
import IdentityCard from './IdentityCard';
import PromptSection from './PromptSection';

const MemberProfile = memo(() => {
  const { t } = useTranslation(['setting', 'chat']);

  // Get agentId from profile store (activeTabId is the selected agent ID)
  const agentId = useGroupProfileStore((s) => s.activeTabId);
  const editor = useGroupProfileStore((s) => s.editor);
  const handleContentChange = useGroupProfileStore((s) => s.handleContentChange);
  const agentBuilderContentUpdate = useGroupProfileStore((s) => s.agentBuilderContentUpdate);
  const setAgentBuilderContent = useGroupProfileStore((s) => s.setAgentBuilderContent);

  // Get agent config by agentId
  const config = useAgentStore(agentByIdSelectors.getAgentConfigById(agentId), isEqual);
  const updateAgentConfigById = useAgentStore((s) => s.updateAgentConfigById);

  const currentGroup = useAgentGroupStore(agentGroupSelectors.currentGroup, isEqual);
  const currentGroupAgents = useAgentGroupStore(agentGroupSelectors.currentGroupAgents, isEqual);

  // Check if the current agent is the supervisor
  const isSupervisor = currentGroup?.supervisorAgentId === agentId;

  // Compute isExternal based on group member properties
  const isExternal = useMemo(() => {
    const agent = currentGroupAgents.find((a) => a.id === agentId);
    return agent ? !agent.isSupervisor && !agent.virtual : false;
  }, [currentGroupAgents, agentId]);

  // Stabilize editorData object reference to prevent unnecessary re-renders
  const editorData = useMemo(
    () => ({
      content: config?.systemRole,
      editorData: config?.editorData,
    }),
    [config?.systemRole, config?.editorData],
  );

  // Wrap updateAgentConfigById for saving editor content
  const updateContent = useCallback(
    async (payload: { content: string; editorData: Record<string, any> }) => {
      await updateAgentConfigById(agentId, {
        editorData: payload.editorData,
        systemRole: payload.content,
      });
    },
    [updateAgentConfigById, agentId],
  );

  // Handle editor content change
  const onContentChange = useCallback(() => {
    handleContentChange(updateContent);
  }, [handleContentChange, updateContent]);

  // Watch for agent builder content updates and apply them directly to the editor
  useEffect(() => {
    if (!editor || !agentBuilderContentUpdate) return;
    if (agentBuilderContentUpdate.entityId !== agentId) return;

    // Directly set the editor content
    editor.setDocument('markdown', agentBuilderContentUpdate.content);

    // Clear the update after processing to prevent re-applying
    setAgentBuilderContent('', '');
  }, [editor, agentBuilderContentUpdate, agentId, setAgentBuilderContent]);

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
      {/* External agent warning or AutoSaveHint */}
      <Flexbox height={66} width={'100%'}>
        {isExternal && !isSupervisor && (
          <Alert
            icon={<Icon icon={InfoIcon} />}
            style={{ width: '100%' }}
            title={t('group.profile.externalAgentWarning', { ns: 'chat' })}
            type="secondary"
            variant={'outlined'}
          />
        )}
        <Flexbox paddingBlock={12}>
          <AutoSaveHint />
        </Flexbox>
      </Flexbox>

      {/* Identity Section: Avatar + Name */}
      <IdentityCard readOnly={isSupervisor} />

      {/* Capability Section: Model + Tools */}
      <CapabilityCard readOnly={isSupervisor} />

      {/* Prompt Editor Section */}
      <PromptSection
        editor={editor}
        editorData={editorData}
        entityId={agentId}
        placeholder={
          isSupervisor
            ? t('group.profile.supervisorPlaceholder', { ns: 'chat' })
            : t('settingAgent.prompt.placeholder')
        }
        onContentChange={onContentChange}
      />

      {/* Action Bar */}
      <ActionBar />
    </Flexbox>
  );
});

export default MemberProfile;
