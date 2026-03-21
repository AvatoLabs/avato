export interface ParsedSSEChunk {
  data: any;
  event: string;
  id?: string;
}

interface SSEEventMessage {
  data: string;
  event: string;
  id: string;
}

interface MutableSSEEventMessage {
  dataLines: string[];
  event: string;
  id: string;
}

const createEmptyMessage = (): MutableSSEEventMessage => ({
  dataLines: [],
  event: '',
  id: '',
});

const finalizeMessage = (message: MutableSSEEventMessage): SSEEventMessage | undefined => {
  if (message.dataLines.length === 0 && !message.event && !message.id) return;

  return {
    data: message.dataLines.join('\n'),
    event: message.event,
    id: message.id,
  };
};

const parseChunkData = (data: string): unknown => {
  try {
    return JSON.parse(data);
  } catch {
    return data.replaceAll('\\n', '\n');
  }
};

const normalizeChunk = (message: SSEEventMessage): ParsedSSEChunk => ({
  data: parseChunkData(message.data),
  event: message.event || 'text',
  ...(message.id ? { id: message.id } : {}),
});

const applyLineToMessage = (line: string, message: MutableSSEEventMessage) => {
  if (!line || line.startsWith(':')) return;

  const colonIndex = line.indexOf(':');
  const field = colonIndex === -1 ? line : line.slice(0, colonIndex);
  const rawValue = colonIndex === -1 ? '' : line.slice(colonIndex + 1);
  const value = rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue;

  switch (field) {
    case 'data': {
      message.dataLines.push(value);
      break;
    }

    case 'event': {
      message.event = value;
      break;
    }

    case 'id': {
      message.id = value;
      break;
    }
  }
};

export const createSSEChunkParser = () => {
  let lineBuffer = '';
  let currentMessage = createEmptyMessage();

  return (raw: string, options?: { flush?: boolean }): ParsedSSEChunk[] => {
    const flush = options?.flush === true;
    const combined = lineBuffer + raw;
    const lines = combined.split('\n');

    lineBuffer = flush ? '' : (lines.pop() ?? '');

    const messages: ParsedSSEChunk[] = [];

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, '');

      if (line === '') {
        const finalized = finalizeMessage(currentMessage);
        if (finalized) messages.push(normalizeChunk(finalized));
        currentMessage = createEmptyMessage();
        continue;
      }

      applyLineToMessage(line, currentMessage);
    }

    if (flush) {
      const finalized = finalizeMessage(currentMessage);
      if (finalized) messages.push(normalizeChunk(finalized));
      currentMessage = createEmptyMessage();
    }

    return messages;
  };
};

export const parseSSEChunks = (raw: string): ParsedSSEChunk[] => {
  const parse = createSSEChunkParser();

  return parse(raw, { flush: true });
};
