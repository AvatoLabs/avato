'use client';

import { ActionIcon, Avatar, DropdownMenu, Icon, Segmented, Text } from '@lobehub/ui';
import { ArrowLeftIcon, Code2, Eye, MoreHorizontal, SquarePen } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { DESKTOP_HEADER_ICON_SIZE } from '@/const/layoutTokens';
import { AutoSaveHint } from '@/features/EditorCanvas';
import NavHeader from '@/features/NavHeader';
import ToggleRightPanelButton from '@/features/RightPanel/ToggleRightPanelButton';

import { usePageEditorStore } from '../store';
import Breadcrumb from './Breadcrumb';
import { useMenu } from './useMenu';

const Header = memo(() => {
  const { t } = useTranslation('file');
  const [documentId, emoji, title, parentId, onBack, setViewMode, viewMode] = usePageEditorStore(
    (s) => [s.documentId, s.emoji, s.title, s.parentId, s.onBack, s.setViewMode, s.viewMode],
  );
  const { menuItems } = useMenu();

  return (
    <NavHeader
      left={
        <>
          {onBack && <ActionIcon icon={ArrowLeftIcon} onClick={onBack} />}
          {/* Breadcrumb - show when page has a parent folder */}
          {parentId && <Breadcrumb />}
          {/* Show icon and title only when there's no parent folder */}
          {!parentId && (
            <>
              {/* Icon */}
              {emoji && <Avatar avatar={emoji} shape={'square'} size={28} />}
              {/* Title */}
              <Text ellipsis style={{ marginLeft: 4 }} weight={500}>
                {title || t('pageEditor.titlePlaceholder')}
              </Text>
            </>
          )}
          {/* Auto Save Status */}
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
                icon: <Icon icon={SquarePen} />,
                title: t('pageEditor.mode.rich'),
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
    />
  );
});

export default Header;
