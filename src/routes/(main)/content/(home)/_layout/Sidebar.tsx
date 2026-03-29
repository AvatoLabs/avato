'use client';

import { Accordion, Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useParams } from 'react-router-dom';

import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';
import QuickAccessSection from '@/features/ResourceSpaces/QuickAccessSection';
import SpaceSection from '@/features/ResourceSpaces/SpaceSection';

import SidebarBody from './Body';
import Header from './Header';

export enum GroupKey {
  QuickAccess = 'quick-access',
  SourceSet = 'source-set',
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
            <Accordion
              defaultExpandedKeys={[GroupKey.QuickAccess, GroupKey.Space, GroupKey.SourceSet]}
              gap={8}
            >
              <QuickAccessSection itemKey={GroupKey.QuickAccess} />
              <SpaceSection itemKey={GroupKey.Space} />
              {spaceId && <SidebarBody itemKey={GroupKey.SourceSet} />}
            </Accordion>
          </Flexbox>
        }
      />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'ResourceHomeSidebar';

export default Sidebar;
