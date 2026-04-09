import { type MenuProps } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { App } from 'antd';
import { CopyPlus, PanelTop, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

import { RESOURCE_ENTRY_ICONS } from '@/config/contentIcons';
import { isDesktop } from '@/const/version';
import { pluginRegistry } from '@/features/Electron/titlebar/RecentlyViewed/plugins';
import { usePageSpaceId } from '@/features/Pages/usePageSpaceId';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { pageSelectors, usePageStore } from '@/store/docs';
import { useElectronStore } from '@/store/electron';
import { useFileStore } from '@/store/file';
import { useSourceSetStore } from '@/store/sourceSet';
import { getPageDetailPath, getPageKindFromDocument } from '@/utils/docs';

interface ActionProps {
  pageId: string;
  toggleEditing: (visible?: boolean) => void;
}

export const useDropdownMenu = ({
  pageId,
  toggleEditing,
}: ActionProps): (() => MenuProps['items']) => {
  const { t } = useTranslation(['common', 'file', 'components', 'sourceSet']);
  const { message, modal } = App.useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const addTab = useElectronStore((s) => s.addTab);
  const pageSpaceId = usePageSpaceId();
  const moveContentItem = useFileStore((s) => s.moveContentItem);
  const removePage = usePageStore((s) => s.removePage);
  const duplicatePage = usePageStore((s) => s.duplicatePage);
  const internalDispatchDocuments = usePageStore((s) => s.internal_dispatchDocuments);
  const document = usePageStore(pageSelectors.getDocumentById(pageId));
  const [addFilesToSourceSet, removeFilesFromSourceSet, useFetchSourceSetList] = useSourceSetStore(
    (s) => [s.addFilesToSourceSet, s.removeFilesFromSourceSet, s.useFetchSourceSetList],
  );
  const sourceSetId = document?.sourceSetId ?? undefined;
  const sourceSetSpaceId = resolveWorkspaceSpaceId({ spaceId: document?.spaceId ?? pageSpaceId });
  const { data: sourceSets = [] } = useFetchSourceSetList(sourceSetSpaceId);
  const href = `${getPageDetailPath(pageId, getPageKindFromDocument(document), document?.spaceId ?? pageSpaceId)}${location.search}`;
  const availableSourceSets = useMemo(
    () => sourceSets.filter((item) => item.id !== sourceSetId),
    [sourceSetId, sourceSets],
  );

  const syncSourceAssignments = useCallback(
    (nextSourceSetId?: string) => {
      if (!document) return;

      internalDispatchDocuments({
        document: {
          ...document,
          sourceSetId: nextSourceSetId ?? null,
        },
        id: pageId,
        type: 'updateDocument',
      });
    },
    [document, internalDispatchDocuments, pageId],
  );

  const handleDelete = useCallback(() => {
    modal.confirm({
      cancelText: t('cancel'),
      content: t('docEditor.deleteConfirm.content', { ns: 'file' }),
      okButtonProps: { danger: true },
      okText: t('delete'),
      onOk: async () => {
        try {
          await removePage(pageId);
          message.success(t('docEditor.deleteSuccess', { ns: 'file' }));
        } catch (error) {
          console.error('Failed to delete page:', error);
          message.error(t('docEditor.deleteError', { ns: 'file' }));
        }
      },
      title: t('docEditor.deleteConfirm.title', { ns: 'file' }),
    });
  }, [message, modal, pageId, removePage, t]);

  const handleDuplicate = useCallback(async () => {
    try {
      await duplicatePage(pageId);
    } catch (error) {
      console.error('Failed to duplicate page:', error);
    }
  }, [duplicatePage, pageId]);

  const handleAddToSourceSet = useCallback(
    async (targetSourceSetId: string) => {
      try {
        await addFilesToSourceSet(targetSourceSetId, [pageId]);
        syncSourceAssignments(targetSourceSetId);
        message.success(t('addToSourceSet.addSuccess', { count: 1, ns: 'sourceSet' }));
      } catch (error: any) {
        console.error(error);
        const isDuplicateError =
          error?.data?.code === 'CONFLICT' || error?.message === 'FILE_ALREADY_IN_KNOWLEDGE_BASE';

        if (isDuplicateError) {
          message.warning(t('addToSourceSet.alreadyExists', { ns: 'sourceSet' }));
        } else {
          message.error(t('addToSourceSet.error', { ns: 'sourceSet' }));
        }
      }
    },
    [addFilesToSourceSet, message, pageId, syncSourceAssignments, t],
  );

  const handleMoveToSourceSet = useCallback(
    async (targetSourceSetId: string) => {
      if (!sourceSetId) return;

      try {
        await removeFilesFromSourceSet(sourceSetId, [pageId]);
        await moveContentItem(pageId, null);
        await addFilesToSourceSet(targetSourceSetId, [pageId]);
        syncSourceAssignments(targetSourceSetId);
        message.success(t('moveToSourceSet.success', { ns: 'sourceSet' }));
      } catch (error: any) {
        console.error(error);
        const isDuplicateError =
          error?.data?.code === 'CONFLICT' || error?.message === 'FILE_ALREADY_IN_KNOWLEDGE_BASE';

        if (isDuplicateError) {
          message.warning(t('addToSourceSet.alreadyExists', { ns: 'sourceSet' }));
        } else {
          message.error(t('moveToSourceSet.error', { ns: 'sourceSet' }));
        }
      }
    },
    [
      addFilesToSourceSet,
      message,
      moveContentItem,
      pageId,
      removeFilesFromSourceSet,
      sourceSetId,
      syncSourceAssignments,
      t,
    ],
  );

  const handleRemoveFromSourceSet = useCallback(() => {
    if (!sourceSetId) return;

    modal.confirm({
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await removeFilesFromSourceSet(sourceSetId, [pageId]);
          syncSourceAssignments(undefined);
          message.success(t('FileManager.actions.removeFromSourceSetSuccess', { ns: 'components' }));
        } catch (error) {
          console.error('Failed to remove page from source set:', error);
          message.error(t('FileManager.actions.removeFromSourceSetError', { ns: 'components' }));
        }
      },
      title: t('FileManager.actions.confirmRemoveFromSourceSet', { count: 1, ns: 'components' }),
    });
  }, [message, modal, pageId, removeFilesFromSourceSet, sourceSetId, syncSourceAssignments, t]);

  return useCallback(() => {
    const sourceSetMenuItems =
      sourceSetId || availableSourceSets.length > 0
        ? [
            ...(sourceSetId
              ? [
                  ...(availableSourceSets.length > 0
                    ? [
                        {
                          children: availableSourceSets.map((sourceSet) => ({
                            key: `move-to-source-set-${sourceSet.id}`,
                            label: sourceSet.name,
                            onClick: () => void handleMoveToSourceSet(sourceSet.id),
                          })),
                          icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />,
                          key: 'move-to-source-set',
                          label: t('FileManager.actions.moveToOtherSourceSet', {
                            ns: 'components',
                          }),
                        },
                      ]
                    : []),
                  {
                    icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetRemove} />,
                    key: 'remove-from-source-set',
                    label: t('FileManager.actions.removeFromSourceSet', { ns: 'components' }),
                    onClick: handleRemoveFromSourceSet,
                  },
                ]
              : [
                  {
                    children: availableSourceSets.map((sourceSet) => ({
                      key: `add-to-source-set-${sourceSet.id}`,
                      label: sourceSet.name,
                      onClick: () => void handleAddToSourceSet(sourceSet.id),
                    })),
                    icon: <Icon icon={RESOURCE_ENTRY_ICONS.sourceSetAdd} />,
                    key: 'add-to-source-set',
                    label: t('FileManager.actions.addToSourceSet', { ns: 'components' }),
                  },
                ]),
            { type: 'divider' as const },
          ]
        : [];

    return [
      ...(isDesktop
        ? [
            {
              icon: <Icon icon={PanelTop} />,
              key: 'openInNewTab',
              label: t('pageList.actions.openInNewTab', { ns: 'file' }),
              onClick: () => {
                const reference = pluginRegistry.parseUrl(href, '');
                if (reference) {
                  addTab(reference);
                  navigate(href);
                }
              },
            },
            { type: 'divider' as const },
          ]
        : []),
      ...sourceSetMenuItems,
      {
        icon: <Icon icon={Pencil} />,
        key: 'rename',
        label: t('rename'),
        onClick: () => toggleEditing(true),
      },
      {
        icon: <Icon icon={CopyPlus} />,
        key: 'duplicate',
        label: t('pageList.duplicate', { ns: 'file' }),
        onClick: handleDuplicate,
      },
      { type: 'divider' },
      {
        danger: true,
        icon: <Icon icon={Trash2} />,
        key: 'delete',
        label: t('delete'),
        onClick: handleDelete,
      },
    ].filter(Boolean) as MenuProps['items'];
  }, [
    addTab,
    availableSourceSets,
    handleAddToSourceSet,
    handleDelete,
    handleDuplicate,
    handleMoveToSourceSet,
    handleRemoveFromSourceSet,
    href,
    navigate,
    sourceSetId,
    t,
    toggleEditing,
  ]);
};
