import { standardizeIdentifier } from '@/utils/identifier';
import { createStarterTableMarkdown } from '@/utils/pageTable';

const DOC_PAGE_ROOT = '/page';
const TABLE_PAGE_ROOT = '/page/table';

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
  return pathname.startsWith(TABLE_PAGE_ROOT) ? TABLE_PAGE_KIND : DEFAULT_PAGE_KIND;
};

export const getPageRootPath = (pageKind: PageKind = DEFAULT_PAGE_KIND): string => {
  return pageKind === TABLE_PAGE_KIND ? TABLE_PAGE_ROOT : DOC_PAGE_ROOT;
};

export const getPageDetailPath = (
  pageId: string,
  pageKind: PageKind = DEFAULT_PAGE_KIND,
): string => {
  const identifier = standardizeIdentifier(pageId);
  const rootPath = getPageRootPath(pageKind);

  return `${rootPath}/${identifier}`;
};

export { createStarterTableMarkdown };
