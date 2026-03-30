import { Avatar, Icon, Text } from '@lobehub/ui';
import dayjs from 'dayjs';
import { type MouseEvent } from 'react';
import { memo, useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { APP_ENTRY_ICONS } from '@/config/entryIcons';
import { isDesktop } from '@/const/version';
import { pluginRegistry } from '@/features/Electron/titlebar/RecentlyViewed/plugins';
import NavItem from '@/features/NavPanel/components/NavItem';
import { pageSelectors, usePageStore } from '@/store/docs';
import { useElectronStore } from '@/store/electron';
import { getPageDetailPath, getPageKindFromDocument, TABLE_PAGE_KIND } from '@/utils/docs';

import Actions from './Actions';
import Editing from './Editing';
import { useDropdownMenu } from './useDropdownMenu';

interface DocumentItemProps {
  className?: string;
  pageId: string;
}

const PageListItem = memo<DocumentItemProps>(({ pageId, className }) => {
  const { t } = useTranslation('file');
  const [editing, selectedPageId, document] = usePageStore((s) => {
    const doc = pageSelectors.getDocumentById(pageId)(s);
    return [s.renamingPageId === pageId, s.selectedPageId, doc] as const;
  });

  const selectPage = usePageStore((s) => s.selectPage);
  const setRenamingPageId = usePageStore((s) => s.setRenamingPageId);
  const addTab = useElectronStore((s) => s.addTab);

  const active = selectedPageId === pageId;
  const pageKind = getPageKindFromDocument(document);
  const href = getPageDetailPath(pageId, pageKind);
  const title =
    document?.title ||
    t(pageKind === TABLE_PAGE_KIND ? 'pageList.tableUntitled' : 'pageList.untitled');
  const emoji = document?.metadata?.emoji;
  const updatedLabel = useMemo(() => {
    if (!document?.updatedAt) return undefined;

    return dayjs().diff(dayjs(document.updatedAt), 'd') < 7
      ? dayjs(document.updatedAt).fromNow()
      : dayjs(document.updatedAt).format('YYYY-MM-DD');
  }, [document?.updatedAt]);

  const toggleEditing = useCallback(
    (visible?: boolean) => {
      setRenamingPageId(visible ? pageId : null);
    },
    [pageId, setRenamingPageId],
  );

  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(
    (e: MouseEvent) => {
      // Skip navigation in current tab when opening in new tab
      if (e.metaKey || e.ctrlKey) return;
      if (!editing) {
        if (isDesktop) {
          clickTimerRef.current = setTimeout(() => {
            clickTimerRef.current = null;
            selectPage(pageId);
          }, 250);
        } else {
          selectPage(pageId);
        }
      }
    },
    [editing, selectPage, pageId],
  );

  const handleDoubleClick = useCallback(() => {
    if (!isDesktop) return;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const reference = pluginRegistry.parseUrl(href, '');
    if (reference) {
      addTab(reference);
      selectPage(pageId);
    }
  }, [href, pageId, addTab, selectPage]);

  // Icon with emoji support
  const icon = useMemo(() => {
    if (emoji) {
      return <Avatar avatar={emoji} size={28} />;
    }
    return <Icon icon={APP_ENTRY_ICONS.page} size={{ size: 18, strokeWidth: 2.2 }} />;
  }, [emoji]);

  const dropdownMenu = useDropdownMenu({ pageId, toggleEditing });

  return (
    <>
      <NavItem
        actions={<Actions dropdownMenu={dropdownMenu} />}
        active={active}
        className={className}
        contextMenuItems={dropdownMenu}
        disabled={editing}
        href={href}
        icon={icon}
        key={pageId}
        title={title}
        extra={
          updatedLabel ? (
            <Text fontSize={11} style={{ color: 'inherit', opacity: active ? 0.7 : 0.5 }}>
              {updatedLabel}
            </Text>
          ) : undefined
        }
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      />
      <Editing
        currentEmoji={emoji}
        documentId={pageId}
        title={title}
        toggleEditing={toggleEditing}
      />
    </>
  );
});

export default PageListItem;
