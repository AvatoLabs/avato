'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';
import { useParams } from 'react-router-dom';

import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';
import LibraryHierarchy from '@/features/ResourceManager/components/LibraryHierarchy';
import { TrashNavItem } from '@/features/ResourceTrash';

import Header from './Header';

const Sidebar = memo(() => {
  const { id, spaceId } = useParams<{ id: string; spaceId?: string }>();

  return (
    <NavPanelPortal navKey="resourceLibrary">
      <SideBarLayout
        header={<Header />}
        body={
          <Flexbox gap={8} height={'100%'} paddingBlock={8} paddingInline={4}>
            <TrashNavItem knowledgeBaseId={id} spaceId={spaceId} />
            <Flexbox flex={1} style={{ minHeight: 0 }}>
              <LibraryHierarchy />
            </Flexbox>
          </Flexbox>
        }
      />
    </NavPanelPortal>
  );
});

Sidebar.displayName = 'LibrarySidebar';

export default Sidebar;
