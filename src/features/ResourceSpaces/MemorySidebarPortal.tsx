'use client';

import { ActionIcon } from '@lobehub/ui';
import { SearchIcon } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { NavPanelPortal } from '@/features/NavPanel';
import SideBarLayout from '@/features/NavPanel/SideBarLayout';
import SubSidebarTitleBar from '@/features/NavPanel/components/SubSidebarTitleBar';
import { useGlobalStore } from '@/store/global';

import MemoryScopeSection from './MemoryScopeSection';
import { buildSpaceMemoryPath } from './paths';

interface MemorySidebarPortalProps {
  activeSpaceId?: string;
  currentScope: 'personal' | 'space';
}

const MemorySidebarHeader = memo<MemorySidebarPortalProps>(({ activeSpaceId, currentScope }) => {
  const { t } = useTranslation('memory');
  const toggleCommandMenu = useGlobalStore((s) => s.toggleCommandMenu);
  const memoryRoot =
    currentScope === 'space' && activeSpaceId ? buildSpaceMemoryPath(activeSpaceId) : '/memory';

  return (
    <SubSidebarTitleBar
      right={
        <ActionIcon
          aria-label={t('tab.search')}
          icon={SearchIcon}
          size={'small'}
          title={t('tab.search')}
          onClick={() => toggleCommandMenu(true)}
        />
      }
      title={t('title')}
      titleTo={memoryRoot}
    />
  );
});

MemorySidebarHeader.displayName = 'MemorySidebarHeader';

const MemorySidebarPortal = memo<MemorySidebarPortalProps>(({ activeSpaceId, currentScope }) => {
  return (
    <NavPanelPortal navKey="memory">
      <SideBarLayout
        body={<MemoryScopeSection activeSpaceId={activeSpaceId} currentScope={currentScope} />}
        header={<MemorySidebarHeader activeSpaceId={activeSpaceId} currentScope={currentScope} />}
      />
    </NavPanelPortal>
  );
});

MemorySidebarPortal.displayName = 'MemorySidebarPortal';

export default MemorySidebarPortal;
