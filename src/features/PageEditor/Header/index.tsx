'use client';

import { ActionIcon, Avatar, DropdownMenu, Icon, Segmented, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { ArrowLeftIcon, Code2, Eye, MoreHorizontal, SquarePen, Table2Icon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import { AutoSaveHint } from '@/features/EditorCanvas';
import NavHeader from '@/features/NavHeader';
import ToggleRightPanelButton from '@/features/RightPanel/ToggleRightPanelButton';
import { TABLE_PAGE_KIND } from '@/utils/page';

import { usePageEditorStore } from '../store';
import Breadcrumb from './Breadcrumb';
import { useMenu } from './useMenu';

const Header = memo(() => {
  const { t } = useTranslation('file');
  const [documentId, emoji, pageKind, title, parentId, onBack, setViewMode, viewMode] =
    usePageEditorStore((s) => [
      s.documentId,
      s.emoji,
      s.pageKind,
      s.title,
      s.parentId,
      s.onBack,
      s.setViewMode,
      s.viewMode,
    ]);
  const { menuItems } = useMenu();
  const isTablePage = pageKind === TABLE_PAGE_KIND;

  return (
    <NavHeader
      left={
        <>
          {onBack && <ActionIcon icon={ArrowLeftIcon} onClick={onBack} />}
          {parentId && <Breadcrumb />}
          {!parentId && (
            <>
              {emoji && <Avatar avatar={emoji} shape={'square'} size={28} />}
              <Text
                ellipsis
                style={{ marginLeft: 4, maxWidth: 240 }}
                type={'secondary'}
                weight={600}
              >
                {title || t('pageEditor.titlePlaceholder')}
              </Text>
            </>
          )}
          {documentId && <AutoSaveHint documentId={documentId} style={{ marginLeft: 6 }} />}
        </>
      }
      right={
        <>
          <Segmented
            size={'small'}
            value={viewMode}
            options={[
              {
                icon: <Icon icon={isTablePage ? Table2Icon : SquarePen} />,
                title: t(isTablePage ? 'pageEditor.mode.table' : 'pageEditor.mode.rich'),
                value: 'rich',
              },
              {
                icon: <Icon icon={Code2} />,
                title: t('pageEditor.mode.markdown'),
                value: 'markdown',
              },
              {
                icon: <Icon icon={Eye} />,
                title: t('pageEditor.mode.preview'),
                value: 'preview',
              },
            ]}
            onChange={(value) => setViewMode(value as typeof viewMode)}
          />
          {/* Three-dot menu */}
          <DropdownMenu
            iconSpaceMode="group"
            items={menuItems}
            placement="bottomRight"
            popupProps={{
              style: {
                minWidth: 200,
              },
            }}
          >
            <ActionIcon icon={MoreHorizontal} size={DESKTOP_HEADER_ICON_SIZE} />
          </DropdownMenu>
          <ToggleRightPanelButton hideWhenExpanded showActive={false} />
        </>
      }
      style={{
        background: cssVar.colorBgContainer,
        borderBottom: `1px solid ${cssVar.colorBorderSecondary}`,
        paddingInline: 12,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
      styles={{
        left: { flex: 1, minWidth: 0 },
        right: { flex: 'none' },
      }}
    />
  );
});

export default Header;
