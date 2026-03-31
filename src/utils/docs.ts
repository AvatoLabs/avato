import { createStarterTableMarkdown } from '@/utils/docsTable';
import { standardizeIdentifier } from '@/utils/identifier';

const DOC_PAGE_ROOT = '/docs';
const DOC_SPACE_ROOT_SEGMENT = '/docs/spaces/';
const TABLE_PAGE_SPACE_PATTERN = /^\/docs(?:\/spaces\/[^/]+)?\/table(?:\/|$)/;
const PAGE_SPACE_PATH_PATTERN = /^\/docs\/spaces\/([^/]+)(?:\/|$)/;

export type PageKind = 'doc' | 'table';

export const DEFAULT_PAGE_KIND: PageKind = 'doc';
export const TABLE_PAGE_KIND: PageKind = 'table';

export const getPageKind = (pageKind?: unknown): PageKind => {
  return pageKind === TABLE_PAGE_KIND ? TABLE_PAGE_KIND : DEFAULT_PAGE_KIND;
};

export const getPageKindFromDocument = (
  document?: { metadata?: Record<string, unknown> } | null,
): PageKind => {
  return getPageKind(document?.metadata?.pageKind);
};

export const getPageKindFromPathname = (pathname: string): PageKind => {
  return TABLE_PAGE_SPACE_PATTERN.test(pathname) ? TABLE_PAGE_KIND : DEFAULT_PAGE_KIND;
};

export const getPageSpaceIdFromPathname = (pathname: string): string | undefined => {
  const match = pathname.match(PAGE_SPACE_PATH_PATTERN);

  return match?.[1];
};

export const getPageRootPath = (
  pageKind: PageKind = DEFAULT_PAGE_KIND,
  spaceId?: string | null,
): string => {
  const docsRoot = spaceId ? `${DOC_SPACE_ROOT_SEGMENT}${spaceId}` : DOC_PAGE_ROOT;

  return pageKind === TABLE_PAGE_KIND ? `${docsRoot}/table` : docsRoot;
};

export const getPageDetailPath = (
  pageId: string,
  pageKind: PageKind = DEFAULT_PAGE_KIND,
  spaceId?: string | null,
): string => {
  const identifier = standardizeIdentifier(pageId);
  const rootPath = getPageRootPath(pageKind, spaceId);

  return `${rootPath}/${identifier}`;
};

export { createStarterTableMarkdown };
