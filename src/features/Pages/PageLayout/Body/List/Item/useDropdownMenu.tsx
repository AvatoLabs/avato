import { type MenuProps } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import { App } from 'antd';
import { CopyPlus, PanelTop, Pencil, Trash2 } from 'lucide-react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { isDesktop } from '@/const/version';
import { pluginRegistry } from '@/features/Electron/titlebar/RecentlyViewed/plugins';
import { pageSelectors, usePageStore } from '@/store/docs';
import { useElectronStore } from '@/store/electron';
import { getPageDetailPath, getPageKindFromDocument } from '@/utils/docs';

interface ActionProps {
  pageId: string;
  toggleEditing: (visible?: boolean) => void;
}

export const useDropdownMenu = ({
  pageId,
  toggleEditing,
}: ActionProps): (() => MenuProps['items']) => {
  const { t } = useTranslation(['common', 'file']);
  const { message, modal } = App.useApp();
  const navigate = useNavigate();
  const addTab = useElectronStore((s) => s.addTab);
  const removePage = usePageStore((s) => s.removePage);
  const duplicatePage = usePageStore((s) => s.duplicatePage);
  const document = usePageStore(pageSelectors.getDocumentById(pageId));
  const href = getPageDetailPath(pageId, getPageKindFromDocument(document));

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

  return useCallback(
    () =>
      [
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
      ].filter(Boolean) as MenuProps['items'],
    [t, toggleEditing, handleDuplicate, handleDelete, href, addTab, navigate],
  );
};
