const MULTILINE_MARKDOWN_MARKERS = ['###', '```', '- **', '* **'];
const MAX_TOPIC_TITLE_LENGTH = 50;

export const sanitizeGeneratedTopicTitle = (value?: string | null): string | null => {
  if (!value) return null;

  const normalized = value.replaceAll('\r\n', '\n').trim();
  if (!normalized) return null;

  if (normalized.includes('\n')) return null;
  if (MULTILINE_MARKDOWN_MARKERS.some((marker) => normalized.includes(marker))) return null;

  const singleLine = normalized
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*]\s+/, '')
    .replaceAll(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim();

  if (!singleLine) return null;
  if (singleLine.length > MAX_TOPIC_TITLE_LENGTH) return null;

  return singleLine;
};
