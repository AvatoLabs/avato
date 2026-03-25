import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { useMemo } from 'react';

import DragUploadZone, { useUploadFiles } from '@/components/DragUploadZone';
import {
  WORKSPACE_COMPOSER_MAX_WIDTH_PX,
  WORKSPACE_COMPOSER_MIN_HEIGHT_PX,
  WORKSPACE_COMPOSER_RADIUS_PX,
} from '@/const/workspaceVisualTokens';
import { type ActionKeys } from '@/features/ChatInput';
import { ChatInputProvider, DesktopChatInput } from '@/features/ChatInput';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useChatStore } from '@/store/chat';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

import SkillInstallBanner from './SkillInstallBanner';
import { useSend } from './useSend';

const leftActions: ActionKeys[] = ['model', 'search', 'memory', 'fileUpload', 'tools'];

const composerStyles = createStaticStyles(({ css, cssVar }) => ({
  composerFrame: css`
    position: relative;
    z-index: 1;

    width: 100%;
    max-width: ${WORKSPACE_COMPOSER_MAX_WIDTH_PX}px;
    margin-inline: auto;

    transition:
      box-shadow ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut};
  `,
}));

const InputArea = () => {
  const { loading, send, inboxAgentId } = useSend();
  const isLobehubSkillEnabled = useServerConfigStore(serverConfigSelectors.enableLobehubSkill);
  const isKlavisEnabled = useServerConfigStore(serverConfigSelectors.enableKlavis);
  const showSkillBanner = isLobehubSkillEnabled || isKlavisEnabled;

  const model = useAgentStore((s) => agentByIdSelectors.getAgentModelById(inboxAgentId)(s));
  const provider = useAgentStore((s) =>
    agentByIdSelectors.getAgentModelProviderById(inboxAgentId)(s),
  );
  const { handleUploadFiles } = useUploadFiles({ model, provider });

  const inputContainerProps = useMemo(
    () => ({
      minHeight: WORKSPACE_COMPOSER_MIN_HEIGHT_PX,
      resize: false,
      style: {
        background: cssVar.colorBgContainer,
        border: `1px solid ${cssVar.colorBorderSecondary}`,
        borderRadius: WORKSPACE_COMPOSER_RADIUS_PX,
        boxShadow: cssVar.boxShadowSecondary,
      },
    }),
    [],
  );

  return (
    <Flexbox gap={20} style={{ marginBottom: 20 }} width={'100%'}>
      <Flexbox
        className={composerStyles.composerFrame}
        style={{ paddingBottom: showSkillBanner ? 32 : 0 }}
      >
        {showSkillBanner && <SkillInstallBanner />}
        <DragUploadZone
          style={{ position: 'relative', zIndex: 1 }}
          onUploadFiles={handleUploadFiles}
        >
          <ChatInputProvider
            agentId={inboxAgentId}
            allowExpand={false}
            leftActions={leftActions}
            chatInputEditorRef={(instance) => {
              if (!instance) return;
              useChatStore.setState({ mainInputEditor: instance });
            }}
            sendButtonProps={{
              disabled: loading,
              generating: loading,
              onStop: () => {},
              shape: 'round',
              size: 36,
            }}
            onSend={send}
            onMarkdownContentChange={(content) => {
              useChatStore.setState({ inputMessage: content });
            }}
          >
            <DesktopChatInput
              actionBarStyle={{ paddingInline: 12, paddingRight: 12 }}
              borderRadius={WORKSPACE_COMPOSER_RADIUS_PX}
              dropdownPlacement="bottomLeft"
              inputContainerProps={inputContainerProps}
            />
          </ChatInputProvider>
        </DragUploadZone>
      </Flexbox>
    </Flexbox>
  );
};

export default InputArea;
