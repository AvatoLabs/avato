'use client';

import { lazy, memo, Suspense } from 'react';

import { useGlobalStore } from '@/store/global';

// Lazy load the CommandMenu component with React lazy
// This splits the CommandMenu code into a separate chunk that only loads when needed
const CmdkComponent = lazy(() => import('@/features/CommandMenu'));

const CmdkLazy = memo(() => {
  const open = useGlobalStore((s) => s.status.showCommandMenu);

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <CmdkComponent />
    </Suspense>
  );
});

CmdkLazy.displayName = 'CmdkLazy';

export default CmdkLazy;
