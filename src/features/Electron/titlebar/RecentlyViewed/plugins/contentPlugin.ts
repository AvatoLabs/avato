import { Database } from 'lucide-react';

import { getRouteById } from '@/config/routes';
import {
  buildFilesRootPath,
  buildSpaceMembersPath,
  buildSpaceSettingsPath,
} from '@/features/ResourceSpaces';

import { type PageReference, type ResolvedPageData, type ResourceParams } from '../types';
import { type PluginContext, type RecentlyViewedPlugin } from './types';
import { createPageReference } from './types';

const resourceIcon = getRouteById('resource')?.icon || Database;

const RESOURCE_PATH_REGEX =
  /^\/(?:content\/(shared|trash)|spaces\/([^/]+)\/(files|settings|members)(?:\/([^/?]+))?)$/;

// Section to title key mapping
const sectionTitleKeys: Record<string, string> = {
  library: 'navigation.sourceSet',
};

export const resourcePlugin: RecentlyViewedPlugin<'resource'> = {
  checkExists(_reference: PageReference<'resource'>, _ctx: PluginContext): boolean {
    return true; // Static page always exists
  },
  generateId(reference: PageReference<'resource'>): string {
    const { section, spaceId } = reference.params;

    if (spaceId && section) return `resource:${spaceId}:${section}`;
    if (spaceId) return `resource:${spaceId}`;
    if (section) return `resource:${section}`;

    return 'resource';
  },

  generateUrl(reference: PageReference<'resource'>): string {
    const { section, spaceId } = reference.params;

    if (!spaceId) return `/content/${section}`;

    if (section === 'settings') return buildSpaceSettingsPath(spaceId);
    if (section === 'members') return buildSpaceMembersPath(spaceId);
    return buildFilesRootPath(spaceId);
  },

  getDefaultIcon() {
    return resourceIcon;
  },

  matchUrl(pathname: string, _searchParams: URLSearchParams): boolean {
    return RESOURCE_PATH_REGEX.test(pathname);
  },

  parseUrl(pathname: string, _searchParams: URLSearchParams): PageReference<'resource'> | null {
    const match = pathname.match(RESOURCE_PATH_REGEX);
    if (!match) return null;

    const legacyGlobalSection = match[1];
    const spaceId = match[2];
    const canonicalSection = match[3];
    const section = legacyGlobalSection || canonicalSection;
    const params: ResourceParams = section ? { section, spaceId } : { spaceId };
    const id = this.generateId({ params } as PageReference<'resource'>);

    return createPageReference('resource', params, id);
  },

  priority: 5,

  resolve(reference: PageReference<'resource'>, ctx: PluginContext): ResolvedPageData {
    const { section } = reference.params;
    const titleKey = section
      ? sectionTitleKeys[section] || 'navigation.resources'
      : 'navigation.resources';

    return {
      exists: true,
      icon: this.getDefaultIcon!(),
      reference,
      title: ctx.t(titleKey as any, { ns: 'electron' }) as string,
      url: this.generateUrl(reference),
    };
  },

  type: 'resource',
};
