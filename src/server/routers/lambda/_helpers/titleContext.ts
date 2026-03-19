export interface TitleContextMessage {
  content?: string | null;
  role: string;
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

export function pickLatestTitleContext(
  messages: TitleContextMessage[],
): TitleGenerationContext | null {
  for (let assistantIndex = messages.length - 1; assistantIndex >= 0; assistantIndex -= 1) {
    const assistantMessage = messages[assistantIndex];
    if (assistantMessage.role !== 'assistant') continue;

    const lastAssistantContent = extractTitleMessageText(assistantMessage.content);
    if (!lastAssistantContent) continue;

    for (let userIndex = assistantIndex - 1; userIndex >= 0; userIndex -= 1) {
      const userMessage = messages[userIndex];
      if (userMessage.role !== 'user') continue;

      const userPrompt = extractTitleMessageText(userMessage.content);
      if (!userPrompt) continue;

      return { lastAssistantContent, userPrompt };
    }
  }

  return null;
}
