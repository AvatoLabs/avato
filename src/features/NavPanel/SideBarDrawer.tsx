'use client';

import { ActionIcon, Flexbox, Text } from '@lobehub/ui';
import { Drawer } from 'antd';
import { cssVar } from 'antd-style';
import { XIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { memo, Suspense } from 'react';

import { DESKTOP_HEADER_ICON_SIZE } from '@/const/layoutTokens';

import { NAV_PANEL_RIGHT_DRAWER_ID } from './';
import SkeletonList from './components/SkeletonList';
import { glassSidebarStyles } from './glassSidebar.styles';
import SideBarHeaderLayout from './SideBarHeaderLayout';

interface SideBarDrawerProps {
  action?: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  open: boolean;
  subHeader?: ReactNode;
  title?: ReactNode;
}

const SideBarDrawer = memo<SideBarDrawerProps>(
  ({ subHeader, open, onClose, children, title, action }) => {
    const size = 280;
    return (
      <Drawer
        destroyOnHidden
        closable={false}
        getContainer={() => document.querySelector(`#${NAV_PANEL_RIGHT_DRAWER_ID}`)!}
        mask={false}
        open={open}
        placement="left"
        size={size}
        classNames={{
          body: glassSidebarStyles.drawerGlassBody,
          header: glassSidebarStyles.drawerGlassHeader,
          wrapper: glassSidebarStyles.drawerGlassWrapper,
        }}
        rootStyle={{
          bottom: 0,
          left: 0,
          overflow: 'hidden',
          position: 'absolute',
          top: 0,
          width: `${size}px`,
        }}
        styles={{
          wrapper: { zIndex: 0 },
        }}
        title={
          <>
            <SideBarHeaderLayout
              showBack={false}
              showTogglePanelButton={false}
              left={
                typeof title === 'string' ? (
                  <Text
                    ellipsis
                    style={{
                      color: cssVar.colorText,
                      fontSize: cssVar.fontSize,
                      fontWeight: 400,
                      paddingLeft: 8,
                    }}
                  >
                    {title}
                  </Text>
                ) : (
                  title
                )
              }
              right={
                <>
                  {action}
                  <ActionIcon icon={XIcon} size={DESKTOP_HEADER_ICON_SIZE} onClick={onClose} />
                </>
              }
            />
            {subHeader}
          </>
        }
        onClose={onClose}
      >
        <Suspense
          fallback={
            <Flexbox gap={1} paddingBlock={1} paddingInline={4}>
              <SkeletonList rows={3} />
            </Flexbox>
          }
        >
          {children}
        </Suspense>
      </Drawer>
    );
  },
);

export default SideBarDrawer;
