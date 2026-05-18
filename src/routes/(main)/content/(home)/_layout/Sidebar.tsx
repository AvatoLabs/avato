'use client';

import { Accordion, Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useParams } from 'react-router-dom';

import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';
import QuickAccessSection from '@/features/ResourceSpaces/QuickAccessSection';
import SpaceSection from '@/features/ResourceSpaces/SpaceSection';

import FilesSection from './FilesSection';
import Header from './Header';

export enum GroupKey {
  Files = 'files',
  QuickAccess = 'quick-access',
  Space = 'space',
}

const Sidebar = memo(() => {
  const { spaceId } = useParams<{ spaceId?: string }>();
  const defaultExpandedKeys = spaceId
    ? [GroupKey.Space, GroupKey.Files]
    : [GroupKey.Space, GroupKey.QuickAccess];

  return (
    <NavPanelPortal navKey="resource">
      <SideBarLayout
        header={<Header />}
        body={
          <Flexbox paddingBlock={8} paddingInline={4}>
            <Accordion defaultExpandedKeys={defaultExpandedKeys} gap={8}>
              <SpaceSection itemKey={GroupKey.Space} />
              {spaceId && <FilesSection itemKey={GroupKey.Files} />}
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
