import type { SpaceMemoryCandidateDraft, UIChatMessage } from '@lobechat/types';

const TOPIC_MEMORY_DEFAULT_TITLE = 'Conversation memory';
const TOPIC_MEMORY_MAX_CONTENT_LENGTH = 4000;
const TOPIC_MEMORY_MAX_MESSAGE_REFS = 3;
const TOPIC_MEMORY_MAX_CONTEXT_MESSAGES = 4;
const TOPIC_MEMORY_MAX_SUMMARY_LENGTH = 240;
const TOPIC_MEMORY_MAX_TITLE_LENGTH = 120;

interface TopicCandidateSource {
  historySummary?: string | null;
  id: string;
  title?: string | null;
}

interface BuildTopicSpaceMemoryCandidateDraftParams {
  messages: UIChatMessage[];
  topic: TopicCandidateSource;
}

const normalizeText = (value?: string | null) => value?.trim().replaceAll(/\s+/g, ' ') ?? '';

const truncateText = (value: string, maxLength: number) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1).trimEnd()}…` : value;

const extractMessageText = (content: unknown): string => {
  if (typeof content === 'string') return normalizeText(content);

  if (!Array.isArray(content)) return '';

  const parts = content
    .map((item) => {
      if (typeof item === 'string') return normalizeText(item);
      if (!item || typeof item !== 'object') return '';

      const candidate = item as { content?: unknown; text?: unknown };
      if (typeof candidate.text === 'string') return normalizeText(candidate.text);
      if (typeof candidate.content === 'string') return normalizeText(candidate.content);

      return '';
    })
    .filter(Boolean);

  return normalizeText(parts.join(' '));
};

const getRecentTextMessages = (messages: UIChatMessage[]) =>
  messages
    .filter((message) => message.role === 'assistant' || message.role === 'user')
    .map((message) => ({
      id: message.id,
      role: message.role,
      text: extractMessageText(message.content),
    }))
    .filter((message) => !!message.text);

export const buildTopicSpaceMemoryCandidateDraft = ({
  messages,
  topic,
}: BuildTopicSpaceMemoryCandidateDraftParams): SpaceMemoryCandidateDraft | null => {
  const recentTextMessages = getRecentTextMessages(messages);
  const recentContextMessages = recentTextMessages.slice(-TOPIC_MEMORY_MAX_CONTEXT_MESSAGES);
  const sourceMessages = recentTextMessages.slice(-TOPIC_MEMORY_MAX_MESSAGE_REFS);
  const historySummary = normalizeText(topic.historySummary);

  const summary =
    historySummary ||
    normalizeText(
      recentContextMessages.map((message) => truncateText(message.text, 120)).join(' / '),
    );

  if (!summary) return null;

  const normalizedTitle = normalizeText(topic.title);
  const title = truncateText(
    normalizedTitle || truncateText(summary, TOPIC_MEMORY_MAX_TITLE_LENGTH),
    TOPIC_MEMORY_MAX_TITLE_LENGTH,
  );

  const contextLines = recentContextMessages.map((message) => {
    const roleLabel = message.role === 'assistant' ? 'Assistant' : 'User';
    return `- ${roleLabel}: ${truncateText(message.text, 220)}`;
  });

  const content = truncateText(
    [
      `Topic: ${title || TOPIC_MEMORY_DEFAULT_TITLE}`,
      `Summary: ${truncateText(summary, TOPIC_MEMORY_MAX_SUMMARY_LENGTH)}`,
      contextLines.length > 0 ? `Recent context:\n${contextLines.join('\n')}` : undefined,
    ]
      .filter(Boolean)
      .join('\n\n'),
    TOPIC_MEMORY_MAX_CONTENT_LENGTH,
  );

  return {
    category: 'general',
    content,
    sourceRefs: [
      {
        id: topic.id,
        kind: 'topic',
        title: normalizedTitle || title || TOPIC_MEMORY_DEFAULT_TITLE,
      },
      ...sourceMessages.map((message) => ({
        id: message.id,
        kind: 'message' as const,
        title: truncateText(message.text, 80),
      })),
    ],
    summary: truncateText(summary, TOPIC_MEMORY_MAX_SUMMARY_LENGTH),
    title: title || TOPIC_MEMORY_DEFAULT_TITLE,
  };
};
