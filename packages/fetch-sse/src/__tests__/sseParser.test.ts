import { describe, expect, it } from 'vitest';

import { createSSEChunkParser, parseSSEChunks } from '../sseParser';

describe('sseParser', () => {
  it('should preserve partial SSE frames across chunks', () => {
    const parse = createSSEChunkParser();

    expect(parse('eve')).toEqual([]);
    expect(parse('nt: text\ndata: "Hel')).toEqual([]);

    expect(parse('lo"\n\nid: err-1\nevent: error\ndata: {"message":"boom"}')).toEqual([
      { data: 'Hello', event: 'text' },
    ]);

    expect(parse('', { flush: true })).toEqual([
      { data: { message: 'boom' }, event: 'error', id: 'err-1' },
    ]);
  });

  it('should join multi-line data when parsing a full payload', () => {
    expect(parseSSEChunks(['event: text', 'data: hello', 'data: world', ''].join('\n'))).toEqual([
      { data: 'hello\nworld', event: 'text' },
    ]);
  });
});
