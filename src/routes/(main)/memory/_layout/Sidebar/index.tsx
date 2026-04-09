import { memo } from 'react';

import MemorySidebarPortal from '@/features/ResourceSpaces/MemorySidebarPortal';

const Sidebar = memo(() => {
  return <MemorySidebarPortal currentScope="personal" />;
});

Sidebar.displayName = 'MemorySidebar';

export default Sidebar;
