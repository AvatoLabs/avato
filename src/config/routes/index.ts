import { type IconProps } from '@lobehub/ui';

import { APP_ENTRY_ICONS } from '@/config/entryIcons';

export interface NavigationRoute {
  /** CMDK i18n key in common namespace */
  cmdkKey: string;
  /** Electron i18n key in electron namespace */
  electronKey: string;
  /** Route icon component */
  icon: IconProps['icon'];
  /** Unique route identifier */
  id: string;
  /** Keywords for CMDK search (fallback) */
  keywords?: string[];
  /** i18n key for CMDK keywords in common namespace */
  keywordsKey?: string;
  /** Route path */
  path: string;
  /** Path prefix for checking current location */
  pathPrefix: string;
  /** Whether route supports dynamic titles (for specific items) */
  useDynamicTitle?: boolean;
}

/**
 * Shared navigation route configuration
 * Used by both Electron navigation and CommandMenu (CMDK)
 */
export const NAVIGATION_ROUTES: NavigationRoute[] = [
  {
    cmdkKey: 'cmdk.community',
    electronKey: 'navigation.discover',
    icon: APP_ENTRY_ICONS.community,
    id: 'community',
    keywords: ['discover', 'market', 'assistant', 'model', 'provider', 'mcp'],
    keywordsKey: 'cmdk.keywords.community',
    path: '/community',
    pathPrefix: '/community',
  },
  {
    cmdkKey: 'cmdk.video',
    electronKey: 'navigation.video',
    icon: APP_ENTRY_ICONS.video,
    id: 'video',
    keywords: ['video', 'generate', 'seedance', 'kling'],
    keywordsKey: 'cmdk.keywords.video',
    path: '/video',
    pathPrefix: '/video',
  },
  {
    cmdkKey: 'cmdk.painting',
    electronKey: 'navigation.image',
    icon: APP_ENTRY_ICONS.image,
    id: 'image',
    keywords: ['painting', 'art', 'generate', 'draw'],
    keywordsKey: 'cmdk.keywords.painting',
    path: '/image',
    pathPrefix: '/image',
  },
  {
    cmdkKey: 'cmdk.avatoStudio',
    electronKey: 'navigation.avatoStudio',
    icon: APP_ENTRY_ICONS.studio,
    id: 'studio',
    keywords: ['workflow', 'mcp', 'automation', 'graph', 'studio'],
    keywordsKey: 'cmdk.keywords.avatoStudio',
    path: '/studio',
    pathPrefix: '/studio',
  },
  {
    cmdkKey: 'cmdk.content',
    electronKey: 'navigation.resources',
    icon: APP_ENTRY_ICONS.resource,
    id: 'resource',
    keywords: ['knowledge', 'files', 'library', 'documents'],
    keywordsKey: 'cmdk.keywords.resources',
    path: '/content',
    pathPrefix: '/content',
  },
  {
    cmdkKey: 'cmdk.pages',
    electronKey: 'navigation.pages',
    icon: APP_ENTRY_ICONS.page,
    id: 'page',
    keywords: ['documents', 'write', 'notes'],
    keywordsKey: 'cmdk.keywords.pages',
    path: '/docs',
    pathPrefix: '/docs',
    useDynamicTitle: true,
  },
  {
    cmdkKey: 'cmdk.memory',
    electronKey: 'navigation.memory',
    icon: APP_ENTRY_ICONS.memory,
    id: 'memory',
    keywords: ['identities', 'contexts', 'preferences', 'experiences'],
    keywordsKey: 'cmdk.keywords.memory',
    path: '/memory',
    pathPrefix: '/memory',
  },
  {
    cmdkKey: 'cmdk.settings',
    electronKey: 'navigation.settings',
    icon: APP_ENTRY_ICONS.settings,
    id: 'settings',
    keywords: ['settings', 'preferences', 'configuration', 'options'],
    keywordsKey: 'cmdk.keywords.settings',
    path: '/settings',
    pathPrefix: '/settings',
  },
];

/**
 * Get route configuration by id
 */
export const getRouteById = (id: string): NavigationRoute | undefined =>
  NAVIGATION_ROUTES.find((r) => r.id === id);

/**
 * Get navigable routes for CMDK (excludes settings which has separate handling)
 */
export const getNavigableRoutes = (): NavigationRoute[] =>
  NAVIGATION_ROUTES.filter((r) =>
    ['community', 'video', 'image', 'studio', 'resource', 'page', 'memory'].includes(r.id),
  );
