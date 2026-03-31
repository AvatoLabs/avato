import { FileText } from 'lucide-react';

import { getRouteById } from '@/config/routes';
import { getPageDetailPath, getPageKindFromDocument, TABLE_PAGE_KIND } from '@/utils/docs';

import { type PageParams, type PageReference, type ResolvedPageData } from '../types';
import { type PluginContext, type RecentlyViewedPlugin } from './types';
import { createPageReference } from './types';

const PAGE_PATH_REGEX =
  /^\/(?:spaces\/([^/]+)\/docs(?:\/(table))?\/([^/?]+)|docs(?:\/spaces\/([^/]+))?(?:\/(table))?\/([^/?]+))$/;

const pageIcon = getRouteById('page')?.icon || FileText;

export const pagePlugin: RecentlyViewedPlugin<'page'> = {
  checkExists(reference: PageReference<'page'>, ctx: PluginContext): boolean {
    const document = ctx.getDocument(reference.params.pageId);
    return document !== undefined;
  },
  generateId(reference: PageReference<'page'>): string {
    return `page:${reference.params.pageId}`;
  },

  generateUrl(reference: PageReference<'page'>): string {
    return getPageDetailPath(
      reference.params.pageId,
      reference.params.pageKind,
      reference.params.spaceId,
    );
  },

  getDefaultIcon() {
    return pageIcon;
  },

  matchUrl(pathname: string, _searchParams: URLSearchParams): boolean {
    return PAGE_PATH_REGEX.test(pathname);
  },

  parseUrl(pathname: string, _searchParams: URLSearchParams): PageReference<'page'> | null {
    const match = pathname.match(PAGE_PATH_REGEX);
    if (!match) return null;

    const [
      ,
      canonicalSpaceId,
      canonicalTableSegment,
      canonicalPageId,
      legacySpaceId,
      legacyTableSegment,
      legacyPageId,
    ] = match;
    const spaceId = canonicalSpaceId || legacySpaceId;
    const tableSegment = canonicalTableSegment || legacyTableSegment;
    const pageId = canonicalPageId || legacyPageId;
    const params: PageParams = {
      pageId,
      pageKind: tableSegment === TABLE_PAGE_KIND ? TABLE_PAGE_KIND : undefined,
      spaceId,
    };
    const id = this.generateId({ params } as PageReference<'page'>);

    return createPageReference('page', params, id);
  },

  priority: 10,

  resolve(reference: PageReference<'page'>, ctx: PluginContext): ResolvedPageData {
    const document = ctx.getDocument(reference.params.pageId);
    const hasStoreData = document !== undefined;
    const cached = reference.cached;
    const pageKind = document ? getPageKindFromDocument(document) : reference.params.pageKind;

    return {
      exists: hasStoreData || cached !== undefined,
      icon: this.getDefaultIcon!(),
      reference,
      title: document?.title || cached?.title || ctx.t('navigation.page', { ns: 'electron' }),
      url: getPageDetailPath(reference.params.pageId, pageKind, reference.params.spaceId),
    };
  },

  type: 'page',
};
