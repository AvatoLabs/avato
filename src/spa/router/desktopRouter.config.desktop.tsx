'use client';

import type { RouteObject } from 'react-router-dom';

import {
  BusinessDesktopRoutesWithMainLayout,
  BusinessDesktopRoutesWithoutMainLayout,
} from '@/business/client/BusinessDesktopRoutes';
import DesktopOnboarding from '@/routes/(desktop)/desktop-onboarding';
// Layouts — sync import (Electron local, no network overhead)
import DesktopMainLayout from '@/routes/(main)/_layout';
// Pages — sync import
import AgentPage from '@/routes/(main)/agent';
import DesktopChatLayout from '@/routes/(main)/agent/_layout';
import AgentCronDetailPage from '@/routes/(main)/agent/cron/[cronId]';
import AgentProfilePage from '@/routes/(main)/agent/profile';
import CommunityLayout from '@/routes/(main)/community/_layout';
import CommunityDetailLayout from '@/routes/(main)/community/(detail)/_layout';
import CommunityDetailAgentPage from '@/routes/(main)/community/(detail)/agent';
import CommunityDetailGroupAgentPage from '@/routes/(main)/community/(detail)/group_agent';
import CommunityDetailMcpPage from '@/routes/(main)/community/(detail)/mcp';
import CommunityDetailModelPage from '@/routes/(main)/community/(detail)/model';
import CommunityDetailPluginRedirectPage from '@/routes/(main)/community/(detail)/plugin';
import CommunityDetailProviderPage from '@/routes/(main)/community/(detail)/provider';
import CommunityDetailUserPage from '@/routes/(main)/community/(detail)/user';
import CommunityListLayout from '@/routes/(main)/community/(list)/_layout';
import CommunityListHomePage from '@/routes/(main)/community/(list)/(home)';
import CommunityListAgentPage from '@/routes/(main)/community/(list)/agent';
import CommunityListAgentLayout from '@/routes/(main)/community/(list)/agent/_layout';
import CommunityListMcpPage from '@/routes/(main)/community/(list)/mcp';
import CommunityListMcpLayout from '@/routes/(main)/community/(list)/mcp/_layout';
import CommunityListModelPage from '@/routes/(main)/community/(list)/model';
import CommunityListModelLayout from '@/routes/(main)/community/(list)/model/_layout';
import CommunityListPluginRedirectPage from '@/routes/(main)/community/(list)/plugin';
import CommunityListProviderPage from '@/routes/(main)/community/(list)/provider';
import ResourceRootRedirectPage from '@/routes/(main)/content';
import ResourceLayout from '@/routes/(main)/content/_layout';
import ResourceHomePage from '@/routes/(main)/content/(home)';
import ResourceHomeLayout from '@/routes/(main)/content/(home)/_layout';
import ResourceSharedPage from '@/routes/(main)/content/shared';
import ContentSourceSetPage from '@/routes/(main)/content/source-sets';
import ContentSourceSetLayout from '@/routes/(main)/content/source-sets/_layout';
import ContentSourceSetSlugPage from '@/routes/(main)/content/source-sets/[slug]';
import ContentSourceSetTrashPage from '@/routes/(main)/content/source-sets/trash';
import ResourceSpaceSettingsPage from '@/routes/(main)/content/spaces/[spaceId]/settings';
import ResourceSpaceTrashPage from '@/routes/(main)/content/spaces/[spaceId]/trash';
import ResourceTrashPage from '@/routes/(main)/content/trash';
import PageIndexPage from '@/routes/(main)/docs';
import DesktopPageLayout from '@/routes/(main)/docs/_layout';
import PageDetailPage from '@/routes/(main)/docs/[id]';
import PageSpacePage from '@/routes/(main)/docs/spaces/[spaceId]';
import PageSpaceDetailPage from '@/routes/(main)/docs/spaces/[spaceId]/[id]';
import PageTableSpacePage from '@/routes/(main)/docs/spaces/[spaceId]/table';
import PageTableSpaceDetailPage from '@/routes/(main)/docs/spaces/[spaceId]/table/[id]';
import PageTablePage from '@/routes/(main)/docs/table';
import PageTableDetailPage from '@/routes/(main)/docs/table/[id]';
import GroupPage from '@/routes/(main)/group';
import DesktopGroupLayout from '@/routes/(main)/group/_layout';
import GroupProfilePage from '@/routes/(main)/group/profile';
import ImagePage from '@/routes/(main)/image';
import DesktopImageLayout from '@/routes/(main)/image/_layout';
import DesktopMemoryLayout from '@/routes/(main)/memory/_layout';
import MemoryHomePage from '@/routes/(main)/memory/(home)';
import MemoryActivitiesPage from '@/routes/(main)/memory/activities';
import MemoryContextsPage from '@/routes/(main)/memory/contexts';
import MemoryExperiencesPage from '@/routes/(main)/memory/experiences';
import MemoryIdentitiesPage from '@/routes/(main)/memory/identities';
import MemoryPreferencesPage from '@/routes/(main)/memory/preferences';
import SettingsTabPage from '@/routes/(main)/settings';
import SettingsLayout from '@/routes/(main)/settings/_layout';
import { ProviderDetailPage, ProviderLayout } from '@/routes/(main)/settings/provider';
import StudioPage from '@/routes/(main)/studio';
import VideoPage from '@/routes/(main)/video';
import DesktopVideoLayout from '@/routes/(main)/video/_layout';
import ShareResourcePage from '@/routes/share/r/[token]';
import ShareTopicPage from '@/routes/share/t/[id]';
import ShareTopicLayout from '@/routes/share/t/[id]/_layout';
import { ErrorBoundary, redirectElement } from '@/utils/router';

// Desktop router configuration — all sync imports for Electron local build
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
                element: <AgentPage />,
                index: true,
              },
              {
                element: <AgentProfilePage />,
                path: 'profile',
              },
              {
                element: <AgentCronDetailPage />,
                path: 'cron/:cronId',
              },
            ],
            element: <DesktopChatLayout />,
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
                element: <GroupPage />,
                index: true,
              },
              {
                element: <GroupProfilePage />,
                path: 'profile',
              },
            ],
            element: <DesktopGroupLayout />,
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
                    element: <CommunityListAgentPage />,
                    index: true,
                  },
                ],
                element: <CommunityListAgentLayout />,
                path: 'agent',
              },
              {
                children: [
                  {
                    element: <CommunityListModelPage />,
                    index: true,
                  },
                ],
                element: <CommunityListModelLayout />,
                path: 'model',
              },
              {
                element: <CommunityListProviderPage />,
                path: 'provider',
              },
              {
                children: [
                  {
                    element: <CommunityListMcpPage />,
                    index: true,
                  },
                ],
                element: <CommunityListMcpLayout />,
                path: 'mcp',
              },
              {
                element: <CommunityListPluginRedirectPage />,
                path: 'plugin',
              },
              {
                element: <CommunityListHomePage />,
                index: true,
              },
            ],
            element: <CommunityListLayout />,
          },
          // Detail routes (with DetailLayout)
          {
            children: [
              {
                element: <CommunityDetailAgentPage />,
                path: 'agent/:slug',
              },
              {
                element: <CommunityDetailGroupAgentPage />,
                path: 'group_agent/:slug',
              },
              {
                element: <CommunityDetailModelPage />,
                path: 'model/:slug',
              },
              {
                element: <CommunityDetailProviderPage />,
                path: 'provider/:slug',
              },
              {
                element: <CommunityDetailMcpPage />,
                path: 'mcp/:slug',
              },
              {
                element: <CommunityDetailPluginRedirectPage />,
                path: 'plugin/:slug',
              },
              {
                element: <CommunityDetailUserPage />,
                path: 'user/:slug',
              },
            ],
            element: <CommunityDetailLayout />,
          },
        ],
        element: <CommunityLayout />,
        errorElement: <ErrorBoundary resetPath="/community" />,
        path: 'community',
      },

      // Resource routes
      {
        children: [
          {
            element: <ResourceRootRedirectPage />,
            index: true,
          },
          {
            children: [
              {
                element: <ResourceSharedPage />,
                path: 'shared',
              },
              {
                element: <ResourceTrashPage />,
                path: 'trash',
              },
              {
                element: <ResourceHomePage />,
                path: 'spaces/:spaceId',
              },
              {
                element: <ResourceHomePage />,
                path: 'spaces/:spaceId/item/:fileId',
              },
              {
                element: <ResourceHomePage />,
                path: 'spaces/:spaceId/:slug',
              },
              {
                element: <ResourceHomePage />,
                path: 'spaces/:spaceId/:slug/item/:fileId',
              },
              {
                element: <ResourceSpaceTrashPage />,
                path: 'spaces/:spaceId/trash',
              },
              {
                element: <ResourceSpaceSettingsPage />,
                path: 'spaces/:spaceId/settings',
              },
              {
                element: <ResourceHomePage />,
                path: ':slug',
              },
              {
                element: <ResourceHomePage />,
                path: 'item/:fileId',
              },
              {
                element: <ResourceHomePage />,
                path: ':slug/item/:fileId',
              },
            ],
            element: <ResourceHomeLayout />,
          },
          {
            children: [
              {
                element: <ContentSourceSetPage />,
                index: true,
              },
              {
                element: <ContentSourceSetTrashPage />,
                path: 'trash',
              },
              {
                element: <ContentSourceSetSlugPage />,
                path: ':slug',
              },
              {
                element: <ContentSourceSetPage />,
                path: 'item/:fileId',
              },
              {
                element: <ContentSourceSetSlugPage />,
                path: ':slug/item/:fileId',
              },
            ],
            element: <ContentSourceSetLayout />,
            path: 'source-sets/:id',
          },
          {
            children: [
              {
                element: <ContentSourceSetPage />,
                index: true,
              },
              {
                element: <ContentSourceSetTrashPage />,
                path: 'trash',
              },
              {
                element: <ContentSourceSetSlugPage />,
                path: ':slug',
              },
              {
                element: <ContentSourceSetPage />,
                path: 'item/:fileId',
              },
              {
                element: <ContentSourceSetSlugPage />,
                path: ':slug/item/:fileId',
              },
            ],
            element: <ContentSourceSetLayout />,
            path: 'spaces/:spaceId/source-sets/:id',
          },
        ],
        element: <ResourceLayout />,
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
                element: <ProviderDetailPage />,
                path: ':providerId',
              },
            ],
            element: <ProviderLayout />,
            path: 'provider',
          },
          // Other settings tabs
          {
            element: <SettingsTabPage />,
            path: ':tab',
          },
        ],
        element: <SettingsLayout />,
        errorElement: <ErrorBoundary resetPath="/settings" />,
        path: 'settings',
      },

      // Memory routes
      {
        children: [
          {
            element: <MemoryHomePage />,
            index: true,
          },
          {
            element: <MemoryIdentitiesPage />,
            path: 'identities',
          },
          {
            element: <MemoryContextsPage />,
            path: 'contexts',
          },
          {
            element: <MemoryPreferencesPage />,
            path: 'preferences',
          },
          {
            element: <MemoryExperiencesPage />,
            path: 'experiences',
          },
          {
            element: <MemoryActivitiesPage />,
            path: 'activities',
          },
        ],
        element: <DesktopMemoryLayout />,
        errorElement: <ErrorBoundary resetPath="/memory" />,
        path: 'memory',
      },

      // Video routes
      {
        children: [
          {
            element: <VideoPage />,
            index: true,
          },
        ],
        element: <DesktopVideoLayout />,
        errorElement: <ErrorBoundary resetPath="/video" />,
        path: 'video',
      },

      // Image routes
      {
        children: [
          {
            element: <ImagePage />,
            index: true,
          },
        ],
        element: <DesktopImageLayout />,
        errorElement: <ErrorBoundary resetPath="/image" />,
        path: 'image',
      },

      // Avato Studio route
      {
        element: <StudioPage />,
        errorElement: <ErrorBoundary resetPath="/studio" />,
        path: 'studio',
      },

      ...BusinessDesktopRoutesWithMainLayout,

      // Pages routes
      {
        children: [
          {
            element: <PageIndexPage />,
            index: true,
          },
          {
            children: [
              {
                element: <PageTablePage />,
                index: true,
              },
              {
                element: <PageTableDetailPage />,
                path: ':id',
              },
            ],
            path: 'table',
          },
          {
            element: <PageDetailPage />,
            path: ':id',
          },
          {
            children: [
              {
                element: <PageSpacePage />,
                index: true,
              },
              {
                children: [
                  {
                    element: <PageTableSpacePage />,
                    index: true,
                  },
                  {
                    element: <PageTableSpaceDetailPage />,
                    path: ':id',
                  },
                ],
                path: 'table',
              },
              {
                element: <PageSpaceDetailPage />,
                path: ':id',
              },
            ],
            path: 'spaces/:spaceId',
          },
        ],
        element: <DesktopPageLayout />,
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
    element: <DesktopMainLayout />,
    errorElement: <ErrorBoundary resetPath="/" />,
    path: '/',
  },

  ...BusinessDesktopRoutesWithoutMainLayout,

  // Share topic route (outside main layout)
  {
    children: [
      {
        element: <ShareTopicPage />,
        path: ':id',
      },
    ],
    element: <ShareTopicLayout />,
    path: '/share/t',
  },
  {
    children: [
      {
        element: <ShareResourcePage />,
        path: ':token',
      },
    ],
    path: '/share/r',
  },
];

// Desktop onboarding route (Electron only in .desktop.tsx)
desktopRoutes.push({
  element: <DesktopOnboarding />,
  errorElement: <ErrorBoundary resetPath="/" />,
  path: '/desktop-onboarding',
});
