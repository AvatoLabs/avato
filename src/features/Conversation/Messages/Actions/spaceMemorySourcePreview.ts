export const buildSpaceMemoryMessageSourceTitle = (content: string) => {
  const normalized = content.replaceAll(/\s+/g, ' ').trim();
  if (!normalized) return 'Conversation Message';

  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
};
