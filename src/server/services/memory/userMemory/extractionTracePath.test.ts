import { describe, expect, it } from 'vitest';

import {
  buildMemoryExtractionTraceBasePath,
  buildMemoryExtractionTracePath,
} from './extractionTracePath';

describe('memory extraction trace path helpers', () => {
  it('builds a base path without user or source identifiers in the storage key', () => {
    const basePath = buildMemoryExtractionTraceBasePath({
      pathPrefix: '/otel-traces',
      source: 'chat_topic',
    });

    expect(basePath).toBe('otel-traces/memory-extraction/chat_topic');
    expect(basePath).not.toContain('user-1');
    expect(basePath).not.toContain('topic-1');
  });

  it('builds a full trace path with an opaque suffix', () => {
    const path = buildMemoryExtractionTracePath({
      now: new Date('2026-04-05T10:00:00.000Z'),
      opaqueId: 'opaque-trace-id',
      pathPrefix: 'otel-traces',
      source: 'chat_topic',
    });

    expect(path).toBe(
      'otel-traces/memory-extraction/chat_topic/trace/2026-04-05T10:00:00.000Z-opaque-trace-id.json',
    );
  });
});
