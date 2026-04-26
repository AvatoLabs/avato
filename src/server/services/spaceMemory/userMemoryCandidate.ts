import type { MemoryExtractionResult } from '@lobechat/memory-user-memory';
import type { SpaceMemoryCandidateDraft, SpaceMemoryCategory } from '@lobechat/types';

const MAX_CONTENT_LENGTH = 4000;
const MAX_MESSAGE_REFS = 3;
const MAX_SUMMARY_LENGTH = 240;
const MAX_TITLE_LENGTH = 120;
const MAX_CONTEXT_CANDIDATES = 3;
const MAX_EXPERIENCE_CANDIDATES = 3;

interface TopicCandidateSource {
  id: string;
  title?: string | null;
}

interface BuildUserMemorySpaceCandidatesParams {
  extraction: MemoryExtractionResult;
  messageIds?: string[];
  topic: TopicCandidateSource;
}

const normalizeText = (value?: string | null) => value?.trim().replaceAll(/\s+/g, ' ') ?? '';

const truncateText = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;

const buildSourceRefs = (topic: TopicCandidateSource, messageIds?: string[]) => [
  {
    id: topic.id,
    kind: 'topic' as const,
    title: normalizeText(topic.title),
  },
  ...(messageIds ?? []).slice(0, MAX_MESSAGE_REFS).map((id) => ({
    id,
    kind: 'message' as const,
  })),
];

const buildCandidate = (params: {
  category: SpaceMemoryCategory;
  contentParts: Array<string | undefined>;
  metadata: Record<string, unknown>;
  sourceRefs: SpaceMemoryCandidateDraft['sourceRefs'];
  summary?: string | null;
  title?: string | null;
}): SpaceMemoryCandidateDraft | null => {
  const summary = normalizeText(params.summary);
  const title = normalizeText(params.title) || summary;
  const content = truncateText(
    params.contentParts
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .join('\n\n'),
    MAX_CONTENT_LENGTH,
  );

  if (!title && !summary && !content) return null;

  return {
    category: params.category,
    content: content || undefined,
    metadata: params.metadata,
    sourceRefs: params.sourceRefs,
    summary: summary ? truncateText(summary, MAX_SUMMARY_LENGTH) : undefined,
    title: truncateText(title || 'Shared memory', MAX_TITLE_LENGTH),
  };
};

export const buildSpaceMemoryCandidatesFromUserMemoryExtraction = ({
  extraction,
  messageIds,
  topic,
}: BuildUserMemorySpaceCandidatesParams): SpaceMemoryCandidateDraft[] => {
  const sourceRefs = buildSourceRefs(topic, messageIds);
  const candidates: SpaceMemoryCandidateDraft[] = [];

  const contextMemories = extraction.outputs.context?.data?.memories ?? [];
  for (const item of contextMemories.slice(0, MAX_CONTEXT_CANDIDATES)) {
    const candidate = buildCandidate({
      category: 'general',
      contentParts: [
        topic.title ? `Topic: ${topic.title}` : undefined,
        item.summary ? `Summary: ${item.summary}` : undefined,
        item.details ? `Details: ${item.details}` : undefined,
        item.withContext?.title ? `Context: ${item.withContext.title}` : undefined,
        item.withContext?.description ? `Description: ${item.withContext.description}` : undefined,
        item.withContext?.currentStatus
          ? `Current status: ${item.withContext.currentStatus}`
          : undefined,
      ],
      metadata: {
        derivedFrom: {
          layer: 'context',
          memoryCategory: item.memoryCategory ?? null,
          memoryType: item.memoryType ?? null,
        },
      },
      sourceRefs,
      summary: item.summary,
      title: item.title || item.withContext?.title || item.summary,
    });

    if (candidate) candidates.push(candidate);
  }

  const experienceMemories = extraction.outputs.experience?.data?.memories ?? [];
  for (const item of experienceMemories.slice(0, MAX_EXPERIENCE_CANDIDATES)) {
    const candidate = buildCandidate({
      category: 'playbook',
      contentParts: [
        topic.title ? `Topic: ${topic.title}` : undefined,
        item.summary ? `Summary: ${item.summary}` : undefined,
        item.details ? `Details: ${item.details}` : undefined,
        item.withExperience?.situation ? `Situation: ${item.withExperience.situation}` : undefined,
        item.withExperience?.action ? `Action: ${item.withExperience.action}` : undefined,
        item.withExperience?.keyLearning
          ? `Key learning: ${item.withExperience.keyLearning}`
          : undefined,
        item.withExperience?.reasoning ? `Reasoning: ${item.withExperience.reasoning}` : undefined,
        item.withExperience?.possibleOutcome
          ? `Possible outcome: ${item.withExperience.possibleOutcome}`
          : undefined,
      ],
      metadata: {
        derivedFrom: {
          layer: 'experience',
          memoryCategory: item.memoryCategory ?? null,
          memoryType: item.memoryType ?? null,
        },
      },
      sourceRefs,
      summary: item.summary,
      title: item.title || item.summary,
    });

    if (candidate) candidates.push(candidate);
  }

  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = [
      candidate.category,
      normalizeText(candidate.summary),
      normalizeText(candidate.title),
    ]
      .join('::')
      .toLowerCase();

    if (seen.has(key)) return false;
    seen.add(key);

    return true;
  });
};
