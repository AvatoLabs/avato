const getNonEmptyString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();

  return normalized.length > 0 ? normalized : undefined;
};

export const normalizePluginAuthor = (author: unknown): string | undefined => {
  const authorName = getNonEmptyString(author);

  if (authorName) return authorName;
  if (!author || typeof author !== 'object') return undefined;

  const { name, userName, url } = author as {
    name?: unknown;
    url?: unknown;
    userName?: unknown;
  };

  return getNonEmptyString(name) || getNonEmptyString(userName) || getNonEmptyString(url);
};
