'use client';

import { type RouteObject } from 'react-router-dom';

import {
  BusinessMobileRoutesWithMainLayout,
  BusinessMobileRoutesWithoutMainLayout,
} from '@/business/client/BusinessMobileRoutes';
import { dynamicElement, dynamicLayout, ErrorBoundary, redirectElement } from '@/utils/router';

// Mobile router configuration (declarative mode)
export const mobileRoutes: RouteObject[] = [
  {
    children: [
      // Chat routes
      {
        children: [
          {
            element: redirectElement('/'),
            index: true,
          },
          {
            children: [
              {
                element: dynamicElement(() => import('@/routes/(mobile)/chat'), 'Mobile > Chat'),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(mobile)/chat/settings'),
                  'Mobile > Chat > Settings',
                ),
                path: 'settings',
              },
            ],
            element: dynamicLayout(
              () => import('@/routes/(mobile)/chat/_layout'),
              'Mobile > Chat > Layout',
            ),
            errorElement: <ErrorBoundary resetPath="/agent" />,
            path: ':aid',
          },
        ],
        path: 'agent',
      },

      // Discover routes with nested structure
      {
        children: [
          // List routes (with ListLayout)
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/(home)'),
                  'Mobile > Discover > List > Home',
                ),
                index: true,
              },
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/community/(list)/agent'),
                      'Mobile > Discover > List > Agent',
                    ),
                    path: 'agent',
                  },
                ],
              },
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/community/(list)/model'),
                      'Mobile > Discover > List > Model',
                    ),
                    path: 'model',
                  },
                ],
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/provider'),
                  'Mobile > Discover > List > Provider',
                ),
                path: 'provider',
              },
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/community/(list)/mcp'),
                      'Mobile > Discover > List > MCP',
                    ),
                    path: 'mcp',
                  },
                ],
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(list)/plugin'),
                  'Mobile > Discover > List > Plugin Legacy Redirect',
                ),
                path: 'plugin',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(mobile)/community/(list)/_layout'),
              'Mobile > Discover > List > Layout',
            ),
          },
          // Detail routes (with DetailLayout)
          {
            children: [
              {
                element: dynamicElement(
                  () =>
                    import('@/routes/(main)/community/(detail)/agent').then(
                      (m) => m.MobileDiscoverAssistantDetailPage,
                    ),
                  'Mobile > Discover > Detail > Agent',
                ),
                path: 'agent/:slug',
              },
              {
                element: dynamicElement(
                  () =>
                    import('@/routes/(main)/community/(detail)/model').then(
                      (m) => m.MobileModelPage,
                    ),
                  'Mobile > Discover > Detail > Model',
                ),
                path: 'model/:slug',
              },
              {
                element: dynamicElement(
                  () =>
                    import('@/routes/(main)/community/(detail)/provider').then(
                      (m) => m.MobileProviderPage,
                    ),
                  'Mobile > Discover > Detail > Provider',
                ),
                path: 'provider/:slug',
              },
              {
                element: dynamicElement(
                  () =>
                    import('@/routes/(main)/community/(detail)/mcp').then((m) => m.MobileMcpPage),
                  'Mobile > Discover > Detail > MCP',
                ),
                path: 'mcp/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/community/(detail)/plugin'),
                  'Mobile > Discover > Detail > Plugin Legacy Redirect',
                ),
                path: 'plugin/:slug',
              },
              {
                element: dynamicElement(
                  () =>
                    import('@/routes/(main)/community/(detail)/user').then(
                      (m) => m.MobileUserDetailPage,
                    ),
                  'Mobile > Discover > Detail > User',
                ),
                path: 'user/:slug',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(mobile)/community/(detail)/_layout'),
              'Mobile > Discover > Detail > Layout',
            ),
          },
        ],
        element: dynamicElement(
          () => import('@/routes/(mobile)/community/_layout'),
          'Mobile > Discover > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/community" />,
        path: 'community',
      },

      // Settings routes
      {
        children: [
          {
            element: dynamicElement(
              () => import('@/routes/(mobile)/settings'),
              'Mobile > Settings',
            ),
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
                  'Mobile > Settings > Provider > Detail',
                ),
                path: ':providerId',
              },
            ],
            element: dynamicLayout(
              () => import('@/routes/(mobile)/settings/provider/_layout'),
              'Mobile > Settings > Provider > Layout',
            ),
            path: 'provider',
          },
          // Other settings tabs (common, agent, memory, tts, about, etc.)
          {
            element: dynamicElement(
              () => import('@/routes/(main)/settings'),
              'Mobile > Settings > Tab',
            ),
            path: ':tab',
          },
        ],
        element: dynamicLayout(
          () => import('@/routes/(mobile)/settings/_layout'),
          'Mobile > Settings > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/settings" />,
        path: 'settings',
      },

      // Space-first workspace routes
      {
        children: [
          {
            element: dynamicElement(
              () => import('@/routes/(main)/spaces/[spaceId]'),
              'Mobile > Space > Redirect',
            ),
            index: true,
          },
          {
            children: [
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/spaces/[spaceId]/docs'),
                      'Mobile > Space > Docs',
                    ),
                    index: true,
                  },
                  {
                    children: [
                      {
                        element: dynamicElement(
                          () => import('@/routes/(main)/spaces/[spaceId]/docs/table'),
                          'Mobile > Space > Docs > Table',
                        ),
                        index: true,
                      },
                      {
                        element: dynamicElement(
                          () => import('@/routes/(main)/spaces/[spaceId]/docs/table/[id]'),
                          'Mobile > Space > Docs > Table > Detail',
                        ),
                        path: ':id',
                      },
                    ],
                    path: 'table',
                  },
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/spaces/[spaceId]/docs/[id]'),
                      'Mobile > Space > Docs > Detail',
                    ),
                    path: ':id',
                  },
                ],
                element: dynamicLayout(
                  () => import('@/routes/(main)/docs/_layout'),
                  'Mobile > Space > Docs > Layout',
                ),
                errorElement: <ErrorBoundary resetPath="/docs" />,
                path: 'docs',
              },
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/(home)'),
                      'Mobile > Space > Files',
                    ),
                    index: true,
                  },
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/(home)'),
                      'Mobile > Space > Files > Item',
                    ),
                    path: 'item/:fileId',
                  },
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/(home)'),
                      'Mobile > Space > Files > Folder',
                    ),
                    path: ':slug',
                  },
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/(home)'),
                      'Mobile > Space > Files > Folder > Item',
                    ),
                    path: ':slug/item/:fileId',
                  },
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/spaces/[spaceId]/trash'),
                      'Mobile > Space > Files > Trash',
                    ),
                    path: 'trash',
                  },
                ],
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)/_layout'),
                  'Mobile > Space > Files > Layout',
                ),
                path: 'files',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/spaces/[spaceId]/settings'),
                  'Mobile > Space > Settings',
                ),
                path: 'settings',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/spaces/[spaceId]/members'),
                  'Mobile > Space > Members',
                ),
                path: 'members',
              },
              {
                children: [
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/source-sets'),
                      'Mobile > Space > Source Set',
                    ),
                    index: true,
                  },
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/source-sets/trash'),
                      'Mobile > Space > Source Set > Trash',
                    ),
                    path: 'trash',
                  },
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/source-sets/[slug]'),
                      'Mobile > Space > Source Set > Slug',
                    ),
                    path: ':slug',
                  },
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/source-sets'),
                      'Mobile > Space > Source Set > Item',
                    ),
                    path: 'item/:fileId',
                  },
                  {
                    element: dynamicElement(
                      () => import('@/routes/(main)/content/source-sets/[slug]'),
                      'Mobile > Space > Source Set > Slug > Item',
                    ),
                    path: ':slug/item/:fileId',
                  },
                ],
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/_layout'),
                  'Mobile > Space > Source Set > Layout',
                ),
                path: 'source-sets/:id',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/content/_layout'),
              'Mobile > Space > Layout',
            ),
          },
        ],
        path: 'spaces/:spaceId',
      },

      // Legacy docs routes
      {
        children: [
          {
            element: dynamicElement(() => import('@/routes/(main)/docs'), 'Mobile > Docs'),
            index: true,
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/docs/table'),
                  'Mobile > Docs > Table',
                ),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/docs/table/[id]'),
                  'Mobile > Docs > Table > Detail',
                ),
                path: ':id',
              },
            ],
            path: 'table',
          },
          {
            element: dynamicElement(
              () => import('@/routes/(main)/docs/[id]'),
              'Mobile > Docs > Detail',
            ),
            path: ':id',
          },
        ],
        element: dynamicLayout(
          () => import('@/routes/(main)/docs/_layout'),
          'Mobile > Docs > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/docs" />,
        path: 'docs',
      },

      // Resource routes (Files & Knowledge Base)
      {
        children: [
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content'),
                  'Mobile > Content > Redirect',
                ),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/shared'),
                  'Mobile > Content > Shared',
                ),
                path: 'shared',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/trash'),
                  'Mobile > Content > Trash',
                ),
                path: 'trash',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Mobile > Content > Space Home',
                ),
                path: 'spaces/:spaceId',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Mobile > Content > Space Home > Item',
                ),
                path: 'spaces/:spaceId/item/:fileId',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Mobile > Content > Space Folder',
                ),
                path: 'spaces/:spaceId/:slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Mobile > Content > Space Folder > Item',
                ),
                path: 'spaces/:spaceId/:slug/item/:fileId',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/spaces/[spaceId]/trash'),
                  'Mobile > Content > Space Trash',
                ),
                path: 'spaces/:spaceId/trash',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/spaces/[spaceId]/settings'),
                  'Mobile > Content > Space Settings',
                ),
                path: 'spaces/:spaceId/settings',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Mobile > Content > Folder',
                ),
                path: ':slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Mobile > Content > Item',
                ),
                path: 'item/:fileId',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/(home)'),
                  'Mobile > Content > Folder > Item',
                ),
                path: ':slug/item/:fileId',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/content/(home)/_layout'),
              'Mobile > Content > Home > Layout',
            ),
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets'),
                  'Mobile > Content > Source Set',
                ),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/trash'),
                  'Mobile > Content > Source Set > Trash',
                ),
                path: 'trash',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/[slug]'),
                  'Mobile > Content > Source Set > Slug',
                ),
                path: ':slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets'),
                  'Mobile > Content > Source Set > Item',
                ),
                path: 'item/:fileId',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/[slug]'),
                  'Mobile > Content > Source Set > Slug > Item',
                ),
                path: ':slug/item/:fileId',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/content/source-sets/_layout'),
              'Mobile > Content > Source Set > Layout',
            ),
            path: 'source-sets/:id',
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets'),
                  'Mobile > Content > Space Source Set',
                ),
                index: true,
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/trash'),
                  'Mobile > Content > Space Source Set > Trash',
                ),
                path: 'trash',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/[slug]'),
                  'Mobile > Content > Space Source Set > Slug',
                ),
                path: ':slug',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets'),
                  'Mobile > Content > Space Source Set > Item',
                ),
                path: 'item/:fileId',
              },
              {
                element: dynamicElement(
                  () => import('@/routes/(main)/content/source-sets/[slug]'),
                  'Mobile > Content > Space Source Set > Slug > Item',
                ),
                path: ':slug/item/:fileId',
              },
            ],
            element: dynamicElement(
              () => import('@/routes/(main)/content/source-sets/_layout'),
              'Mobile > Content > Space Source Set > Layout',
            ),
            path: 'spaces/:spaceId/source-sets/:id',
          },
        ],
        element: dynamicElement(
          () => import('@/routes/(main)/content/_layout'),
          'Mobile > Content > Layout',
        ),
        errorElement: <ErrorBoundary resetPath="/content" />,
        path: 'content',
      },

      ...BusinessMobileRoutesWithMainLayout,

      // Me routes (mobile personal center)
      {
        children: [
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(mobile)/me/(home)'),
                  'Mobile > Me > Home',
                ),
                index: true,
              },
            ],
            element: dynamicLayout(
              () => import('@/routes/(mobile)/me/(home)/layout'),
              'Mobile > Me > Home > Layout',
            ),
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(mobile)/me/profile'),
                  'Mobile > Me > Profile',
                ),
                path: 'profile',
              },
            ],
            element: dynamicLayout(
              () => import('@/routes/(mobile)/me/profile/layout'),
              'Mobile > Me > Profile > Layout',
            ),
          },
          {
            children: [
              {
                element: dynamicElement(
                  () => import('@/routes/(mobile)/me/settings'),
                  'Mobile > Me > Settings',
                ),
                path: 'settings',
              },
            ],
            element: dynamicLayout(
              () => import('@/routes/(mobile)/me/settings/layout'),
              'Mobile > Me > Settings > Layout',
            ),
          },
        ],
        errorElement: <ErrorBoundary resetPath="/me" />,
        path: 'me',
      },

      // Default route - home page
      {
        children: [
          {
            element: dynamicElement(() => import('@/routes/(mobile)/(home)/'), 'Mobile > Home'),
            index: true,
          },
        ],
        element: dynamicLayout(
          () => import('@/routes/(mobile)/(home)/_layout'),
          'Mobile > Home > Layout',
        ),
      },

      // Catch-all route
      {
        element: redirectElement('/'),
        path: '*',
      },
    ],
    element: dynamicLayout(() => import('@/routes/(mobile)/_layout'), 'Mobile > Main > Layout'),
    errorElement: <ErrorBoundary resetPath="/" />,
    path: '/',
  },
  // Onboarding route (outside main layout)
  {
    element: dynamicElement(() => import('@/routes/onboarding'), 'Mobile > Onboarding'),
    errorElement: <ErrorBoundary resetPath="/" />,
    path: '/onboarding',
  },
  ...BusinessMobileRoutesWithoutMainLayout,

  // Share topic route (outside main layout)
  {
    children: [
      {
        element: dynamicElement(() => import('@/routes/share/t/[id]'), 'Mobile > Share > Topic'),
        path: ':id',
      },
    ],
    element: dynamicElement(
      () => import('@/routes/share/t/[id]/_layout'),
      'Mobile > Share > Topic > Layout',
    ),
    path: '/share/t',
  },
  {
    children: [
      {
        element: dynamicElement(
          () => import('@/routes/share/r/[token]'),
          'Mobile > Share > Resource',
        ),
        path: ':token',
      },
    ],
    path: '/share/r',
  },
];
