export interface DocumentOutlineItem {
  id: string;
  level: number;
  text: string;
}

const CJK_CHARACTER_REGEX = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/g;
const LATIN_WORD_REGEX = /[A-Z0-9]+(?:['’-][A-Z0-9]+)*/gi;
// eslint-disable-next-line regexp/no-super-linear-backtracking -- The pattern correctly matches markdown headings without catastrophic backtracking
const MARKDOWN_HEADING_REGEX = /^(#{1,6})\s+([^\n]+)$/gm;

const stripMarkdownDecoration = (value: string) =>
  value
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll(/[`*_~>#-]/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();

export const normalizeHeadingText = (value: string) => stripMarkdownDecoration(value).toLowerCase();

export const countDocumentWords = (content: string) => {
  if (!content) return 0;

  const cjkCount = content.match(CJK_CHARACTER_REGEX)?.length || 0;
  const latinCount =
    content.replaceAll(CJK_CHARACTER_REGEX, ' ').match(LATIN_WORD_REGEX)?.length || 0;

  return cjkCount + latinCount;
};

export const estimateReadingMinutes = (wordCount: number) => {
  if (wordCount <= 0) return 0;

  return Math.max(1, Math.ceil(wordCount / 260));
};

export const extractDocumentOutline = (
  content: string,
  limit: number = Number.POSITIVE_INFINITY,
): DocumentOutlineItem[] => {
  if (!content) return [];

  const usedIds = new Map<string, number>();
  const items: DocumentOutlineItem[] = [];
  let match = MARKDOWN_HEADING_REGEX.exec(content);

  while (match) {
    const marks = match[1];
    const rawText = match[2];
    const text = stripMarkdownDecoration(rawText);

    if (text) {
      const baseId =
        normalizeHeadingText(text)
          .replaceAll(/[^a-z0-9\u4E00-\u9FFF]+/g, '-')
          .replaceAll(/^-+|-+$/g, '') || 'section';
      const duplicateIndex = usedIds.get(baseId) || 0;
      usedIds.set(baseId, duplicateIndex + 1);

      items.push({
        id: duplicateIndex === 0 ? baseId : `${baseId}-${duplicateIndex + 1}`,
        level: marks.length,
        text,
      });

      if (items.length >= limit) break;
    }

    match = MARKDOWN_HEADING_REGEX.exec(content);
  }

  return items;
};
