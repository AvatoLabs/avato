'use client';

import { Accordion, Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useParams } from 'react-router-dom';

import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';
import SpaceSection from '@/features/ResourceSpaces/SpaceSection';

import SidebarBody from './Body';
import Header from './Header';

export enum GroupKey {
  Library = 'library',
  Space = 'space',
}

const Sidebar = memo(() => {
  const { spaceId } = useParams<{ spaceId?: string }>();

  return (
    <NavPanelPortal navKey="resource">
      <SideBarLayout
        header={<Header />}
        body={
          <Flexbox paddingBlock={8} paddingInline={4}>
            <Accordion defaultExpandedKeys={[GroupKey.Space, GroupKey.Library]} gap={8}>
              <SpaceSection itemKey={GroupKey.Space} />
              {spaceId && <SidebarBody itemKey={GroupKey.Library} />}
            </Accordion>
          </Flexbox>
        }
      />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'ResourceHomeSidebar';

export default Sidebar;
