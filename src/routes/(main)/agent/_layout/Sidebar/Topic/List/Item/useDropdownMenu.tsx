import { type MenuProps } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { App } from 'antd';
import {
  ExternalLink,
  LibraryBig,
  LucideCopy,
  PanelTop,
  PencilLine,
  Star,
  Trash,
  Wand2,
} from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { isDesktop } from '@/const/version';
import { pluginRegistry } from '@/features/Electron/titlebar/RecentlyViewed/plugins';
import { useOpenCreateSpaceMemoryCandidateModal } from '@/features/ResourceSpaces/useOpenCreateSpaceMemoryCandidateModal';
import { useSpaceMemoryCandidateTargets } from '@/features/ResourceSpaces/useSpaceMemoryCandidateTargets';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { useAgentStore } from '@/store/agent/store';
import { useChatStore } from '@/store/chat';
import { useElectronStore } from '@/store/electron';
import { useGlobalStore } from '@/store/global';

interface TopicItemDropdownMenuProps {
  fav?: boolean;
  id?: string;
  title: string;
  toggleEditing: (visible?: boolean) => void;
}

export const useTopicItemDropdownMenu = ({
  fav,
  id,
  title,
  toggleEditing,
}: TopicItemDropdownMenuProps): (() => MenuProps['items']) => {
  const { t } = useTranslation(['topic', 'common', 'file']);
  const { modal } = App.useApp();
  const navigate = useNavigate();
  const activeSpaceId = resolveWorkspaceSpaceId();
  const { defaultSpaceId } = useSpaceMemoryCandidateTargets(activeSpaceId);
  const canAddToSpaceMemory = Boolean(defaultSpaceId);
  const openCreateSpaceMemoryCandidateModal = useOpenCreateSpaceMemoryCandidateModal();

  const openTopicInNewWindow = useGlobalStore((s) => s.openTopicInNewWindow);
  const activeAgentId = useAgentStore((s) => s.activeAgentId);
  const addTab = useElectronStore((s) => s.addTab);

  const [autoRenameTopicTitle, duplicateTopic, removeTopic, favoriteTopic] = useChatStore((s) => [
    s.autoRenameTopicTitle,
    s.duplicateTopic,
    s.removeTopic,
    s.favoriteTopic,
  ]);

  return useCallback(() => {
    if (!id) return [];

    return [
      {
        icon: <Icon icon={Star} />,
        key: 'favorite',
        label: fav ? t('actions.unfavorite') : t('actions.favorite'),
        onClick: () => {
          favoriteTopic(id, !fav);
        },
      },
      {
        type: 'divider' as const,
      },
      {
        icon: <Icon icon={Wand2} />,
        key: 'autoRename',
        label: t('actions.autoRename'),
        onClick: () => {
          autoRenameTopicTitle(id);
        },
      },
      {
        icon: <Icon icon={PencilLine} />,
        key: 'rename',
        label: t('rename', { ns: 'common' }),
        onClick: () => {
          toggleEditing(true);
        },
      },
      ...(isDesktop
        ? [
            {
              icon: <Icon icon={PanelTop} />,
              key: 'openInNewTab',
              label: t('actions.openInNewTab'),
              onClick: () => {
                if (!activeAgentId) return;
                const url = `/agent/${activeAgentId}?topic=${id}`;
                const reference = pluginRegistry.parseUrl(`/agent/${activeAgentId}`, `topic=${id}`);
                if (reference) {
                  addTab(reference);
                  navigate(url);
                }
              },
            },
            {
              icon: <Icon icon={ExternalLink} />,
              key: 'openInNewWindow',
              label: t('actions.openInNewWindow'),
              onClick: () => {
                if (activeAgentId) openTopicInNewWindow(activeAgentId, id);
              },
            },
          ]
        : []),
      {
        icon: <Icon icon={LucideCopy} />,
        key: 'duplicate',
        label: t('actions.duplicate'),
        onClick: () => {
          duplicateTopic(id);
        },
      },
      ...(canAddToSpaceMemory
        ? [
            {
              icon: <Icon icon={LibraryBig} />,
              key: 'addToSpaceMemory',
              label: t('space.memory.actions.addFromSource', { ns: 'file' }),
              onClick: () =>
                openCreateSpaceMemoryCandidateModal({
                  defaultTitle: title,
                  initialSpaceId: defaultSpaceId,
                  sourceRefs: [{ id, kind: 'topic', title }],
                }),
            },
          ]
        : []),
      {
        type: 'divider' as const,
      },
      {
        danger: true,
        icon: <Icon icon={Trash} />,
        key: 'delete',
        label: t('delete', { ns: 'common' }),
        onClick: () => {
          modal.confirm({
            centered: true,
            okButtonProps: { danger: true },
            onOk: async () => {
              await removeTopic(id);
            },
            title: t('actions.confirmRemoveTopic'),
          });
        },
      },
    ].filter(Boolean) as MenuProps['items'];
  }, [
    id,
    fav,
    activeAgentId,
    autoRenameTopicTitle,
    canAddToSpaceMemory,
    defaultSpaceId,
    duplicateTopic,
    favoriteTopic,
    removeTopic,
    openCreateSpaceMemoryCandidateModal,
    openTopicInNewWindow,
    addTab,
    navigate,
    title,
    toggleEditing,
    t,
    modal,
  ]);
};
