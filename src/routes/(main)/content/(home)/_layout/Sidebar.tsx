'use client';

import { Accordion, Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useParams } from 'react-router-dom';

import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';
import QuickAccessSection from '@/features/ResourceSpaces/QuickAccessSection';
import SpaceSection from '@/features/ResourceSpaces/SpaceSection';

import SidebarBody from './Body';
import FileScopeSection from './FileScopeSection';
import Header from './Header';

export enum GroupKey {
  FileScope = 'file-scope',
  QuickAccess = 'quick-access',
  SourceSet = 'source-set',
  Space = 'space',
}

const Sidebar = memo(() => {
  const { spaceId } = useParams<{ spaceId?: string }>();
  const defaultExpandedKeys = spaceId
    ? [GroupKey.Space, GroupKey.FileScope, GroupKey.SourceSet]
    : [GroupKey.Space, GroupKey.QuickAccess];

  return (
    <NavPanelPortal navKey="resource">
      <SideBarLayout
        header={<Header />}
        body={
          <Flexbox paddingBlock={8} paddingInline={4}>
            <Accordion gap={8} defaultExpandedKeys={defaultExpandedKeys}>
              <SpaceSection itemKey={GroupKey.Space} />
              {spaceId && <FileScopeSection itemKey={GroupKey.FileScope} />}
              {spaceId && <SidebarBody itemKey={GroupKey.SourceSet} />}
              <QuickAccessSection itemKey={GroupKey.QuickAccess} />
            </Accordion>
          </Flexbox>
        }
      />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'ResourceHomeSidebar';

export default Sidebar;
