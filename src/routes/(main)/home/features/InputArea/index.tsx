import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { type MouseEvent, useCallback, useMemo } from 'react';

import DragUploadZone, { useUploadFiles } from '@/components/DragUploadZone';
import {
  WORKSPACE_COMPOSER_MAX_WIDTH_PX,
  WORKSPACE_COMPOSER_MIN_HEIGHT_PX,
  WORKSPACE_COMPOSER_RADIUS_PX,
} from '@/const/workspaceVisualTokens';
import { type ActionKeys } from '@/features/ChatInput';
import { ChatInputProvider, DesktopChatInput } from '@/features/ChatInput';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';

import SkillInstallBanner from './SkillInstallBanner';
import StarterList from './StarterList';
import { useSend } from './useSend';

const leftActions: ActionKeys[] = ['model', 'fileUpload', 'tools'];

const composerStyles = createStaticStyles(({ css, cssVar }) => ({
  composerFrame: css`
    position: relative;
    z-index: 1;

    display: flex;
    flex-direction: column;
    gap: 12px;

    width: 100%;
    min-width: 0;
    max-width: ${WORKSPACE_COMPOSER_MAX_WIDTH_PX}px;
    margin-inline: auto;

    transition:
      box-shadow ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut};
  `,
  editorHitArea: css`
    width: 100%;
    min-width: 0;
  `,
}));

const isInteractiveTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;

  return Boolean(
    target.closest(
      [
        'a',
        'button',
        'input',
        'label',
        'select',
        'summary',
        'textarea',
        '[contenteditable="true"]',
        '[contenteditable=""]',
        '[role="button"]',
        '[role="menuitem"]',
        '[role="option"]',
        '[data-no-composer-focus]',
      ].join(','),
    ),
  );
};

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
  const focusComposer = useCallback((event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if (event.defaultPrevented) return;
    if (isInteractiveTarget(event.target)) return;

    useChatStore.getState().mainInputEditor?.focus();
  }, []);

  const inputContainerProps = useMemo(
    () => ({
      minHeight: WORKSPACE_COMPOSER_MIN_HEIGHT_PX,
      onBodyClick: focusComposer,
      onClick: focusComposer,
      resize: false,
      style: {
        background: cssVar.colorBgContainer,
        border: `1px solid ${cssVar.colorBorderSecondary}`,
        borderRadius: WORKSPACE_COMPOSER_RADIUS_PX,
        boxShadow: cssVar.boxShadowSecondary,
      },
    }),
    [focusComposer],
  );

  return (
    <Flexbox gap={12} width={'100%'}>
      <Flexbox className={composerStyles.composerFrame} gap={12}>
        <StarterList />
        {showSkillBanner && <SkillInstallBanner />}
        <DragUploadZone
          style={{ position: 'relative', zIndex: 1 }}
          onUploadFiles={handleUploadFiles}
        >
          <div className={composerStyles.editorHitArea}>
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
                variant: 'chatgpt',
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
          </div>
        </DragUploadZone>
      </Flexbox>
    </Flexbox>
  );
};

export default InputArea;
