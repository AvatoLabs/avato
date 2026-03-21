import { LOADING_FLAT } from '@lobechat/const';

export interface TitleContextMessage {
  children?: unknown;
  compressedMessages?: unknown;
  content?: string | null;
  role?: string | null;
}

export interface TitleGenerationContext {
  lastAssistantContent: string;
  userPrompt: string;
}

export function extractTitleMessageText(content: string | null | undefined): string {
  if (!content || typeof content !== 'string') return '';

  try {
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      return parsed
        .map((part: { content?: string; text?: string }) => part?.text ?? part?.content ?? '')
        .filter(Boolean)
        .join(' ')
        .trim();
    }
  } catch {
    // Plain text content.
  }

  return content.trim();
}

const asTitleContextMessages = (value: unknown): TitleContextMessage[] => {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is TitleContextMessage => typeof item === 'object' && item !== null,
  );
};

const extractComparableMessages = (
  messages: readonly TitleContextMessage[] | undefined,
): TitleContextMessage[] => {
  const flattened: TitleContextMessage[] = [];

  const visit = (message: TitleContextMessage) => {
    const role = message.role ?? '';

    if (role === 'compareGroup') {
      for (const child of asTitleContextMessages(message.children)) visit(child);
      return;
    }

    if (role === 'compressedGroup') {
      for (const child of asTitleContextMessages(message.compressedMessages)) visit(child);
      return;
    }

    if (role === 'assistantGroup') {
      const content = extractTitleMessageText(message.content);
      if (content && content !== LOADING_FLAT) {
        flattened.push({ content, role: 'assistant' });
      }

      for (const child of asTitleContextMessages(message.children)) visit(child);
      return;
    }

    const content = extractTitleMessageText(message.content);
    if ((role === 'user' || role === 'assistant') && content && content !== LOADING_FLAT) {
      flattened.push({ content, role });
    }

    for (const child of asTitleContextMessages(message.children)) visit(child);
  };

  for (const message of messages ?? []) visit(message);

  return flattened;
};

export function pickLatestTitleContext(
  messages: readonly TitleContextMessage[] | undefined,
): TitleGenerationContext | null {
  const comparableMessages = extractComparableMessages(messages);

  for (
    let assistantIndex = comparableMessages.length - 1;
    assistantIndex >= 0;
    assistantIndex -= 1
  ) {
    const assistantMessage = comparableMessages[assistantIndex];
    if (assistantMessage.role !== 'assistant') continue;

    const lastAssistantContent = extractTitleMessageText(assistantMessage.content);
    if (!lastAssistantContent) continue;

    for (let userIndex = assistantIndex - 1; userIndex >= 0; userIndex -= 1) {
      const userMessage = comparableMessages[userIndex];
      if (userMessage.role !== 'user') continue;

      const userPrompt = extractTitleMessageText(userMessage.content);
      if (!userPrompt) continue;

      return { lastAssistantContent, userPrompt };
    }
  }

  return null;
}
