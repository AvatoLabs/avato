import { type ActionIconGroupItemType } from '@lobehub/ui';
import { copyToClipboard } from '@lobehub/ui';
import { App } from 'antd';
import { Copy, Edit, LanguagesIcon, LibraryBig, Play, RotateCcw, Trash } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useOpenCreateSpaceMemoryCandidateModal } from '@/features/ResourceSpaces/useOpenCreateSpaceMemoryCandidateModal';
import { useSpaceMemoryCandidateTargets } from '@/features/ResourceSpaces/useSpaceMemoryCandidateTargets';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { localeOptions } from '@/locales/contents';
import { type UIChatMessage } from '@/types/index';

import { messageStateSelectors, useConversationStore } from '../../../store';
import { buildSpaceMemoryMessageSourceTitle } from '../../Actions/spaceMemorySourcePreview';

export interface ActionItem extends ActionIconGroupItemType {
  children?: Array<{ handleClick?: () => void; key: string; label: string }>;
  handleClick?: () => void | Promise<void>;
}

export interface UserActions {
  addToSpaceMemory?: ActionItem;
  copy: ActionItem;
  del: ActionItem;
  divider: { type: 'divider' };
  edit: ActionItem;
  regenerate: ActionItem;
  translate: ActionItem;
  tts: ActionItem;
}

interface UseUserActionsParams {
  data: UIChatMessage;
  id: string;
}

export const useUserActions = ({ id, data }: UseUserActionsParams): UserActions => {
  const { t } = useTranslation(['common', 'chat', 'file']);
  const { message } = App.useApp();
  const activeSpaceId = resolveWorkspaceSpaceId();
  const { defaultSpaceId, teamSpaces } = useSpaceMemoryCandidateTargets(activeSpaceId);
  const openCreateSpaceMemoryCandidateModal = useOpenCreateSpaceMemoryCandidateModal();
  const sourceTitle = buildSpaceMemoryMessageSourceTitle(data.content);

  // Get state from ConversationStore
  const isRegenerating = useConversationStore(messageStateSelectors.isMessageRegenerating(id));

  // Get actions from ConversationStore
  const [toggleMessageEditing, deleteMessage, regenerateUserMessage, translateMessage, ttsMessage] =
    useConversationStore((s) => [
      s.toggleMessageEditing,
      s.deleteMessage,
      s.regenerateUserMessage,
      s.translateMessage,
      s.ttsMessage,
    ]);

  return useMemo<UserActions>(
    () => ({
      addToSpaceMemory:
        teamSpaces.length > 0
          ? {
              handleClick: () =>
                openCreateSpaceMemoryCandidateModal({
                  defaultSummary: data.content,
                  defaultTitle: sourceTitle,
                  initialSpaceId: defaultSpaceId,
                  sourceRefs: [{ id, kind: 'message', title: sourceTitle }],
                }),
              icon: LibraryBig,
              key: 'addToSpaceMemory',
              label: t('space.memory.actions.addFromSource', { ns: 'file' }),
            }
          : undefined,
      copy: {
        handleClick: async () => {
          await copyToClipboard(data.content);
          message.success(t('copySuccess'));
        },
        icon: Copy,
        key: 'copy',
        label: t('copy'),
      },
      del: {
        danger: true,
        handleClick: () => deleteMessage(id),
        icon: Trash,
        key: 'del',
        label: t('delete'),
      },
      divider: {
        type: 'divider',
      },
      edit: {
        handleClick: () => {
          toggleMessageEditing(id, true);
        },
        icon: Edit,
        key: 'edit',
        label: t('edit'),
      },
      regenerate: {
        disabled: isRegenerating,
        handleClick: () => {
          regenerateUserMessage(id);
          if (data.error) deleteMessage(id);
        },
        icon: RotateCcw,
        key: 'regenerate',
        label: t('regenerate'),
        spin: isRegenerating || undefined,
      },
      translate: {
        children: localeOptions.map((i) => ({
          key: i.value,
          label: t(`lang.${i.value}`),
          onClick: () => translateMessage(id, i.value),
        })),
        icon: LanguagesIcon,
        key: 'translate',
        label: t('translate.action', { ns: 'chat' }),
      },
      tts: {
        handleClick: () => ttsMessage(id),
        icon: Play,
        key: 'tts',
        label: t('tts.action', { ns: 'chat' }),
      },
    }),
    [
      t,
      id,
      defaultSpaceId,
      data.content,
      data.error,
      isRegenerating,
      teamSpaces.length,
      toggleMessageEditing,
      deleteMessage,
      regenerateUserMessage,
      translateMessage,
      ttsMessage,
      openCreateSpaceMemoryCandidateModal,
      sourceTitle,
      message,
    ],
  );
};
