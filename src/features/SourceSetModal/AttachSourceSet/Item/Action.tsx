import { ActionIcon, Button, DropdownMenu, Flexbox, Icon } from '@lobehub/ui';
import { CheckIcon, InfoIcon, MoreVerticalIcon, Trash2 } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isCanonicalDocumentEntry } from '@/features/ContentManager/utils/isCanonicalDocumentEntry';
import { buildFilesPreviewPath, buildSourceSetPath } from '@/features/ResourceSpaces';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { useServerConfigStore } from '@/store/serverConfig';
import { useSessionStore } from '@/store/session/store';
import { AgentSourceKind } from '@/types/sourceSet';
import { getPageDetailPath } from '@/utils/docs';

import { type SourceSetModalScope } from '../types';

interface ActionsProps {
  enabled?: boolean;
  id: string;
  scope: SourceSetModalScope;
  spaceId?: string | null;
  type: AgentSourceKind;
}

const Actions = memo<ActionsProps>(({ id, type, enabled, scope, spaceId }) => {
  const { t } = useTranslation('chat');
  const targetSpaceId = resolveWorkspaceSpaceId({ spaceId });
  const activeGroupId = useChatStore((s) => s.activeGroupId);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const conversationFileContext = activeGroupId
    ? { groupId: activeGroupId }
    : { agentId: activeAgentId };

  const mobile = useServerConfigStore((s) => s.isMobile);
  const [addFilesToAgent, attachSourceSetToAgent, removeFilesFromAgent, detachSourceSetFromAgent] =
    useAgentStore((s) => [
      s.addFilesToAgent,
      s.attachSourceSetToAgent,
      s.removeFileFromAgent,
      s.detachSourceSetFromAgent,
    ]);
  const [addFilesToConversation, deleteConversationFile] = useSessionStore((s) => [
    s.addFilesToConversation,
    s.deleteConversationFile,
  ]);

  const [loading, setLoading] = useState(false);

  const assignSource = async () => {
    setLoading(true);
    if (scope === 'conversation') {
      await addFilesToConversation([id], conversationFileContext);
    } else if (type === AgentSourceKind.SourceSet) {
      await attachSourceSetToAgent(id);
    } else {
      await addFilesToAgent([id], true);
    }
    setLoading(false);
  };

  const removeSource = async () => {
    setLoading(true);
    if (scope === 'conversation') {
      await deleteConversationFile(id, conversationFileContext);
    } else if (type === AgentSourceKind.SourceSet) {
      await detachSourceSetFromAgent(id);
    } else {
      await removeFilesFromAgent(id);
    }
    setLoading(false);
  };

  if (scope === 'conversation') {
    return (
      <Flexbox horizontal align={'center'}>
        <Button
          icon={enabled ? <Icon icon={CheckIcon} /> : undefined}
          loading={loading}
          size={mobile ? 'small' : undefined}
          type={enabled ? 'default' : 'primary'}
          onClick={enabled ? removeSource : assignSource}
        >
          {enabled
            ? t('conversationFiles.picker.action.added')
            : t('conversationFiles.picker.action.add')}
        </Button>
      </Flexbox>
    );
  }

  return (
    <Flexbox horizontal align={'center'}>
      {enabled ? (
        <DropdownMenu
          placement="bottomRight"
          items={[
            {
              icon: <Icon icon={InfoIcon} />,
              key: 'detail',
              label: t('sourceSet.picker.action.detail'),
              onClick: () => {
                if (type === AgentSourceKind.SourceSet) {
                  window.open(buildSourceSetPath(targetSpaceId, id));
                  return;
                }

                window.open(
                  isCanonicalDocumentEntry({ id })
                    ? getPageDetailPath(id, 'doc', targetSpaceId)
                    : buildFilesPreviewPath(targetSpaceId, id),
                );
              },
            },
            {
              danger: true,
              icon: <Icon icon={Trash2} />,
              key: 'remove',
              label: t('sourceSet.picker.action.remove'),
              onClick: removeSource,
            },
          ]}
        >
          <ActionIcon icon={MoreVerticalIcon} loading={loading} />
        </DropdownMenu>
      ) : (
        <Button
          loading={loading}
          size={mobile ? 'small' : undefined}
          type={'primary'}
          onClick={assignSource}
        >
          {t('sourceSet.picker.action.add')}
        </Button>
      )}
    </Flexbox>
  );
});

export default Actions;
