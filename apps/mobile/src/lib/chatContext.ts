import type { ChatContextSelection, DocSelection, FileListItem } from '../types';
import { fileApi, notebookApi, resourceApi } from './api';
import { getNotebookTableContextContent, isTableNotebookDocument } from './notebookDocument';
import { getCanonicalResourceKind } from './resourceList';

const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.mdown', '.mdx', '.mkd'];
const MARKDOWN_MIME_TYPES = new Set([
  'application/markdown',
  'markdown',
  'md',
  'mdown',
  'mdx',
  'mkd',
  'text/markdown',
  'text/x-markdown',
]);

type ContextLike = Pick<ChatContextSelection, 'content' | 'docId'> &
  Partial<Pick<ChatContextSelection, 'preview' | 'title'>>;

const contextLabel = (selection: ContextLike) => selection.title || selection.preview || selection.docId;

export const isMarkdownResource = (
  fileType?: string | null,
  name?: string | null,
): boolean => {
  const lowerFileName = name?.toLowerCase();
  const lowerFileType = fileType?.toLowerCase();

  if (lowerFileName && MARKDOWN_EXTENSIONS.some((ext) => lowerFileName.endsWith(ext))) {
    return true;
  }

  if (lowerFileType && MARKDOWN_MIME_TYPES.has(lowerFileType)) {
    return true;
  }

  return false;
};

export const isChatContextEligibleResource = (
  item: Pick<FileListItem, 'fileType' | 'id' | 'name' | 'sourceType'>,
) =>
  item.fileType !== 'custom/folder' &&
  (getCanonicalResourceKind(item) === 'document' || isMarkdownResource(item.fileType, item.name));

export const toDocSelections = (contexts: ChatContextSelection[]): DocSelection[] =>
  contexts.map((context) => ({
    content: context.content,
    docId: context.docId,
    id: context.id,
    xml: context.content,
  }));

export const buildDocContextDisplayText = (contexts: ContextLike[]) =>
  contexts.map((context) => `- ${contextLabel(context)}`).join('\n');

export const buildDocContextPromptText = (contexts: ContextLike[]) =>
  contexts
    .map((context) => {
      const label = contextLabel(context);
      const content = context.content.trim();
      return content ? `- ${label}:\n${content}` : `- ${label}`;
    })
    .join('\n');

const normalizePreview = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  return trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed;
};

export const createChatContextSelectionFromResource = async (
  item: Pick<FileListItem, 'fileType' | 'id' | 'name' | 'sourceType'>,
): Promise<ChatContextSelection | null> => {
  if (!isChatContextEligibleResource(item)) return null;

  if (getCanonicalResourceKind(item) === 'document') {
    const document = await notebookApi.get(item.id).catch(() => null);
    if (!document) return null;

    const content = isTableNotebookDocument(document)
      ? getNotebookTableContextContent(document)
      : document.content?.trim();

    if (!content) return null;

    const title = document?.title?.trim() || item.name;

    return {
      content,
      docId: item.id,
      format: 'markdown',
      id: `document-context-${item.id}`,
      preview: normalizePreview(title),
      title,
      type: 'text',
    };
  }

  const ensured = await resourceApi.ensureFileDocument(item.id).catch(() => null);
  if (!ensured?.id) return null;

  const previewDocument = await resourceApi.previewFileContent(item.id).catch(() => null);
  const extractedContent =
    previewDocument?.content?.trim() ||
    previewDocument?.pages
      ?.map((page) => page?.pageContent?.trim())
      .filter(Boolean)
      .join('\n\n') ||
    '';

  const fallbackContent =
    extractedContent ||
    (await fileApi
      .getFileContents([item.id])
      .then((items) => items.find((candidate) => candidate.fileId === item.id)?.content?.trim() || '')
      .catch(() => ''));

  if (!fallbackContent) return null;

  const title = previewDocument?.title?.trim() || item.name;

  return {
    content: fallbackContent,
    docId: ensured.id,
    format: 'markdown',
    id: `document-context-${ensured.id}`,
    preview: normalizePreview(title),
    title,
    type: 'text',
  };
};
