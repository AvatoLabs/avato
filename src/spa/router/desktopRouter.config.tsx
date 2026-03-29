'use client';

import { type RouteObject } from 'react-router-dom';

import {
  BusinessDesktopRoutesWithMainLayout,
  BusinessDesktopRoutesWithoutMainLayout,
} from '@/business/client/BusinessDesktopRoutes';
import { dynamicElement, dynamicLayout, ErrorBoundary, redirectElement } from '@/utils/router';

// Desktop router configuration (declarative mode)
export const desktopRoutes: RouteObject[] = [
  {
    children: [
      // Chat routes (agent)
      {
        children: [
          {
            element: redirectElement('/'),
            index: true,
          },
          {
            children: [
              {
                element: dynamicElement(() => import('@/routes/(main)/agent'), 'Desktop > Chat'),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/agent/profile'),
                  'Desktop > Chat > Profile',
                ),
                path: 'profile',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/agent/cron/[cronId]'),
                  'Desktop > Chat > Cron Detail',
                ),
                path: 'cron/:cronId',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/agent/channel'),
                  'Desktop > Chat > Channel',
                ),
                path: 'channel',
              },
            ],
            element: dynamicLayout(
              () => import('@/routes/(main)/agent/_layout'),
              'Desktop > Chat > Layout',
            ),
            errorElement: <ErrorBoundary resetPath="/agent" />,
            path: ':aid',
          },
        ],
        path: 'agent',
      },

      // Group chat routes
      {
        children: [
          {
            element: redirectElement('/'),
            index: true,
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/group'),
                  'Desktop > Agent Group',
                ),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/group/profile'),
                  'Desktop > Agent Group > Profile',
                ),
                path: 'profile',
              },
            ],
            element: dynamicLayout(
              () => import('@/routes/(main)/group/_layout'),
              'Desktop > Group > Layout',
            ),
            errorElement: <ErrorBoundary resetPath="/group" />,
            path: ':gid',
          },
        ],
        path: 'group',
      },

      // Discover routes with nested structure
      {
        children: [
          // List routes (with ListLayout)
          {
            children: [
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/community/(list)/agent'),
                      'Desktop > Discover > List > Agent',
                    ),
                    index: true,
                  },
                ],
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/agent/_layout'),
                  'Desktop > Discover > List > Agent > Layout',
                ),
                path: 'agent',
              },
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/community/(list)/model'),
                      'Desktop > Discover > List > Model',
                    ),
                    index: true,
                  },
                ],
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/model/_layout'),
                  'Desktop > Discover > List > Model > Layout',
                ),
                path: 'model',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/provider'),
                  'Desktop > Discover > List > Provider',
                ),
                path: 'provider',
              },
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/community/(list)/skill'),
                      'Desktop > Discover > List > Skill',
                    ),
                    index: true,
                  },
                ],
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/skill/_layout'),
                  'Desktop > Discover > List > Skill > Layout',
                ),
                path: 'skill',
              },
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/community/(list)/mcp'),
                      'Desktop > Discover > List > MCP',
                    ),
                    index: true,
                  },
                ],
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/mcp/_layout'),
                  'Desktop > Discover > List > MCP > Layout',
                ),
                path: 'mcp',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/plugin'),
                  'Desktop > Discover > List > Plugin Legacy Redirect',
                ),
                path: 'plugin',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/aggregator'),
                  'Desktop > Discover > List > Aggregator',
                ),
                path: 'aggregator',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/(home)'),
                  'Desktop > Discover > List > Home',
                ),
                index: true,
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/community/(list)/_layout'),
              'Desktop > Discover > List > Layout',
            ),
          },
          // Detail routes (with DetailLayout)
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(detail)/agent'),
                  'Desktop > Discover > Detail > Agent',
                ),
                path: 'agent/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(detail)/group_agent'),
                  'Desktop > Discover > Detail > Group Agent',
                ),
                path: 'group_agent/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(detail)/model'),
                  'Desktop > Discover > Detail > Model',
                ),
                path: 'model/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(detail)/provider'),
                  'Desktop > Discover > Detail > Provider',
                ),
                path: 'provider/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(detail)/skill'),
                  'Desktop > Discover > Detail > Skill',
                ),
                path: 'skill/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(detail)/mcp'),
                  'Desktop > Discover > Detail > MCP',
                ),
                path: 'mcp/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(detail)/plugin'),
                  'Desktop > Discover > Detail > Plugin Legacy Redirect',
                ),
                path: 'plugin/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(detail)/user'),
                  'Desktop > Discover > Detail > User',
                ),
                path: 'user/:slug',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/community/(detail)/_layout'),
              'Desktop > Discover > Detail > Layout',
            ),
          },
        ],
        element: dynamicElement(
          () => import('@/routes/(main)/community/_layout'),
          'Desktop > Discover > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/community" />,
        path: 'community',
      },

      // Resource routes
      {
        children: [
          {
            element: dynamicElement(
              () => import('@/routes/(main)/content'),
              'Desktop > Content > Redirect',
            ),
            index: true,
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/shared'),
                  'Desktop > Content > Shared',
                ),
                path: 'shared',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/trash'),
                  'Desktop > Content > Trash',
                ),
                path: 'trash',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Desktop > Content > Space Home',
                ),
                path: 'spaces/:spaceId',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Desktop > Content > Space Folder',
                ),
                path: 'spaces/:spaceId/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/spaces/[spaceId]/trash'),
                  'Desktop > Content > Space Trash',
                ),
                path: 'spaces/:spaceId/trash',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/spaces/[spaceId]/settings'),
                  'Desktop > Content > Space Settings',
                ),
                path: 'spaces/:spaceId/settings',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Desktop > Content > Folder',
                ),
                path: ':slug',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/content/(home)/_layout'),
              'Desktop > Content > Home > Layout',
            ),
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets'),
                  'Desktop > Content > Source Set',
                ),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/trash'),
                  'Desktop > Content > Source Set > Trash',
                ),
                path: 'trash',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/[slug]'),
                  'Desktop > Content > Source Set > Slug',
                ),
                path: ':slug',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/content/source-sets/_layout'),
              'Desktop > Content > Source Set > Layout',
            ),
            path: 'source-sets/:id',
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets'),
                  'Desktop > Content > Space Source Set',
                ),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/trash'),
                  'Desktop > Content > Space Source Set > Trash',
                ),
                path: 'trash',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/[slug]'),
                  'Desktop > Content > Space Source Set > Slug',
                ),
                path: ':slug',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/content/source-sets/_layout'),
              'Desktop > Content > Space Source Set > Layout',
            ),
            path: 'spaces/:spaceId/source-sets/:id',
          },
        ],
        element: dynamicElement(
          () => import('@/routes/(main)/content/_layout'),
          'Desktop > Content > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/content" />,
        path: 'content',
      },

      // Settings routes
      {
        children: [
          {
            element: redirectElement('/settings/profile'),
            index: true,
          },
          // Provider routes with nested structure
          {
            children: [
              {
                element: redirectElement('/settings/provider/all'),
                index: true,
              },
              {
                element: dynamicElement(
                  () =>
                    import('@/routes/(main)/settings/provider').then((m) => m.ProviderDetailPage),
                  'Desktop > Settings > Provider > Detail',
                ),
                path: ':providerId',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/settings/provider').then((m) => m.ProviderLayout),
              'Desktop > Settings > Provider > Layout',
            ),
            path: 'provider',
          },
          // Other settings tabs
          {
            element: dynamicElement(
              () => import('@/routes/(main)/settings'),
              'Desktop > Settings > Tab',
            ),
            path: ':tab',
          },
        ],
        element: dynamicElement(
          () => import('@/routes/(main)/settings/_layout'),
          'Desktop > Settings > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/settings" />,
        path: 'settings',
      },

      // Memory routes
      {
        children: [
          {
            element: dynamicElement(
              () => import('@/routes/(main)/memory/(home)'),
              'Desktop > Memory > Home',
            ),
            index: true,
          },
          {
            element: dynamicElement(
              () => import('@/routes/(main)/memory/identities'),
              'Desktop > Memory > Identities',
            ),
            path: 'identities',
          },
          {
            element: dynamicElement(
              () => import('@/routes/(main)/memory/contexts'),
              'Desktop > Memory > Contexts',
            ),
            path: 'contexts',
          },
          {
            element: dynamicElement(
              () => import('@/routes/(main)/memory/preferences'),
              'Desktop > Memory > Preferences',
            ),
            path: 'preferences',
          },
          {
            element: dynamicElement(
              () => import('@/routes/(main)/memory/experiences'),
              'Desktop > Memory > Experiences',
            ),
            path: 'experiences',
          },
          {
            element: dynamicElement(
              () => import('@/routes/(main)/memory/activities'),
              'Desktop > Memory > Activities',
            ),
            path: 'activities',
          },
        ],
        element: dynamicLayout(
          () => import('@/routes/(main)/memory/_layout'),
          'Desktop > Memory > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/memory" />,
        path: 'memory',
      },

      // Video routes
      {
        children: [
          {
            element: dynamicElement(() => import('@/routes/(main)/video'), 'Desktop > Video'),
            index: true,
          },
        ],
        element: dynamicLayout(
          () => import('@/routes/(main)/video/_layout'),
          'Desktop > Video > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/video" />,
        path: 'video',
      },

      // Image routes
      {
        children: [
          {
            element: dynamicElement(() => import('@/routes/(main)/image'), 'Desktop > Image'),
            index: true,
          },
        ],
        element: dynamicLayout(
          () => import('@/routes/(main)/image/_layout'),
          'Desktop > Image > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/image" />,
        path: 'image',
      },

      // Avato Studio route
      {
        element: dynamicElement(() => import('@/routes/(main)/studio'), 'Desktop > Avato Studio'),
        errorElement: <ErrorBoundary resetPath="/studio" />,
        path: 'studio',
      },

      ...BusinessDesktopRoutesWithMainLayout,

      // Pages routes
      {
        children: [
          {
            element: dynamicElement(() => import('@/routes/(main)/docs'), 'Desktop > Page'),
            index: true,
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/docs/table'),
                  'Desktop > Page > Table',
                ),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/docs/table/[id]'),
                  'Desktop > Page > Table > Detail',
                ),
                path: ':id',
              },
            ],
            path: 'table',
          },
          {
            element: dynamicElement(
              () => import('@/routes/(main)/docs/[id]'),
              'Desktop > Page > Detail',
            ),
            path: ':id',
          },
        ],
        element: dynamicLayout(
          () => import('@/routes/(main)/docs/_layout'),
          'Desktop > Page > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/docs" />,
        path: 'docs',
      },

      // Default route - home page (handled by persistent layout)
      {
        element: <></>,
        index: true,
      },
      // Catch-all route
      {
        element: redirectElement('/'),
        path: '*',
      },
    ],
    element: dynamicLayout(() => import('@/routes/(main)/_layout'), 'Desktop > Main > Layout'),
    errorElement: <ErrorBoundary resetPath="/" />,
    path: '/',
  },
  // Onboarding route (outside main layout)

  ...BusinessDesktopRoutesWithoutMainLayout,

  // Share topic route (outside main layout)
  {
    children: [
      {
        element: dynamicElement(() => import('@/routes/share/t/[id]'), 'Desktop > Share > Topic'),
        path: ':id',
      },
    ],
    element: dynamicElement(
      () => import('@/routes/share/t/[id]/_layout'),
      'Desktop > Share > Topic > Layout',
    ),
    path: '/share/t',
  },
  {
    children: [
      {
        element: dynamicElement(
          () => import('@/routes/share/r/[token]'),
          'Desktop > Share > Resource',
        ),
        path: ':token',
      },
    ],
    path: '/share/r',
  },
];

desktopRoutes.push({
  element: dynamicElement(() => import('@/routes/onboarding'), 'Desktop > Onboarding'),
  errorElement: <ErrorBoundary resetPath="/" />,
  path: '/onboarding',
});
