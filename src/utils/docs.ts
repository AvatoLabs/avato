import { createStarterTableMarkdown } from '@/utils/docsTable';
import { standardizeIdentifier } from '@/utils/identifier';

const DOC_SPACE_ROOT_SEGMENT = '/spaces/';
const TABLE_PAGE_PATTERNS = [/^\/spaces\/[^/]+\/docs\/table(?:\/|$)/];
const PAGE_SPACE_PATH_PATTERNS = [/^\/spaces\/([^/]+)\/docs(?:\/|$)/];

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
  return TABLE_PAGE_PATTERNS.some((pattern) => pattern.test(pathname))
    ? TABLE_PAGE_KIND
    : DEFAULT_PAGE_KIND;
};

export const getPageSpaceIdFromPathname = (pathname: string): string | undefined => {
  for (const pattern of PAGE_SPACE_PATH_PATTERNS) {
    const match = pathname.match(pattern);

    if (match?.[1]) return match[1];
  }

  return undefined;
};

export const getPageRootPath = (
  pageKind: PageKind = DEFAULT_PAGE_KIND,
  spaceId?: string | null,
): string => {
  if (!spaceId) return '/spaces';

  const docsRoot = `${DOC_SPACE_ROOT_SEGMENT}${spaceId}/docs`;

  return pageKind === TABLE_PAGE_KIND ? `${docsRoot}/table` : docsRoot;
};

export const getPageDetailPath = (
  pageId: string,
  pageKind: PageKind = DEFAULT_PAGE_KIND,
  spaceId?: string | null,
): string => {
  if (!spaceId) return '/spaces';

  const identifier = standardizeIdentifier(pageId);
  const rootPath = getPageRootPath(pageKind, spaceId);

  return `${rootPath}/${identifier}`;
};

export { createStarterTableMarkdown };
