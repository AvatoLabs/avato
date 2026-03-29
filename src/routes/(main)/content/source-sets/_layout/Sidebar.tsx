'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useParams } from 'react-router-dom';

import SourceSetTree from '@/features/ContentManager/components/SourceSetTree';
import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';
import { TrashNavItem } from '@/features/ResourceTrash';

import Header from './Header';

const Sidebar = memo(() => {
  const { id, spaceId } = useParams<{ id: string; spaceId?: string }>();

  return (
    <NavPanelPortal navKey="contentSourceSets">
      <SideBarLayout
        header={<Header />}
        body={
          <Flexbox gap={8} height={'100%'} paddingBlock={8} paddingInline={4}>
            <TrashNavItem sourceSetId={id} spaceId={spaceId} />
            <Flexbox flex={1} style={{ minHeight: 0 }}>
              <SourceSetTree />
            </Flexbox>
          </Flexbox>
        }
      />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'SourceSetSidebar';

export default Sidebar;
