import { join } from 'pathe';

type BuildMemoryExtractionTracePathParams = {
  now?: Date;
  opaqueId?: string;
  pathPrefix?: string;
  source: string;
};

const normalizePrefix = (pathPrefix?: string) => {
  if (!pathPrefix) return '';
  return pathPrefix.startsWith('/') ? pathPrefix.slice(1) : pathPrefix;
};

export const buildMemoryExtractionTraceBasePath = ({
  pathPrefix,
  source,
}: Pick<BuildMemoryExtractionTracePathParams, 'pathPrefix' | 'source'>) =>
  join(normalizePrefix(pathPrefix), `memory-extraction/${source}`);

export const buildMemoryExtractionTracePath = ({
  now = new Date(),
  opaqueId = crypto.randomUUID(),
  pathPrefix,
  source,
}: BuildMemoryExtractionTracePathParams) =>
  join(
    buildMemoryExtractionTraceBasePath({ pathPrefix, source }),
    'trace',
    `${now.toISOString()}-${opaqueId}.json`,
  );
