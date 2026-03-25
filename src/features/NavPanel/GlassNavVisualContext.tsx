'use client';

import { createContext, memo, type ReactNode, use } from 'react';

const GlassNavVisualContext = createContext(false);

export const GlassNavVisualProvider = memo<{ children: ReactNode }>(({ children }) => (
  <GlassNavVisualContext value={true}>{children}</GlassNavVisualContext>
));

GlassNavVisualProvider.displayName = 'GlassNavVisualProvider';

export const useGlassNavVisual = () => use(GlassNavVisualContext);
