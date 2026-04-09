import { describe, expect, it, vi } from 'vitest';

import { ReadyDocsAgentRuntime } from './lobe-docs-agent';

describe('ReadyDocsAgentRuntime', () => {
  it('waits for editor initialization before writing markdown', async () => {
    let initializedHandler: ((editor: unknown) => void) | undefined;

    const editor = {
      getDocument: vi.fn().mockReturnValue({ children: [] }),
      getLexicalEditor: vi.fn().mockReturnValue(null),
      off: vi.fn(),
      once: vi.fn((event: string, handler: (editor: unknown) => void) => {
        if (event === 'initialized') initializedHandler = handler;
        return editor;
      }),
      setDocument: vi.fn(),
    };

    const runtime = new ReadyDocsAgentRuntime();
    runtime.setEditor(editor as any);

    const pending = runtime.initDoc({ markdown: 'Hello world' });

    expect(editor.setDocument).not.toHaveBeenCalled();

    initializedHandler?.({});

    await pending;

    expect(editor.setDocument).toHaveBeenCalledWith('markdown', 'Hello world', { keepId: true });
  });

  it('returns empty page content while the editor is still booting', () => {
    const editor = {
      getLexicalEditor: vi.fn().mockReturnValue(null),
      off: vi.fn(),
      once: vi.fn(),
    };

    const runtime = new ReadyDocsAgentRuntime();
    runtime.setTitleHandlers(null, () => 'Draft Title');
    runtime.setEditor(editor as any);

    expect(runtime.getDocContentContext('both')).toEqual({
      markdown: '',
      metadata: {
        charCount: 0,
        lineCount: 0,
        title: 'Draft Title',
      },
      xml: '',
    });
  });

  it('returns fallback page content when external text context is provided', () => {
    const runtime = new ReadyDocsAgentRuntime();

    runtime.setFallbackDocContentContext({
      markdown: '# Resource Title\n\nLoaded from resource viewer.',
      metadata: {
        title: 'Resource Title',
      },
      xml: '<document></document>',
    });

    expect(runtime.getDocContentContext('both')).toEqual({
      markdown: '# Resource Title\n\nLoaded from resource viewer.',
      metadata: {
        charCount: 46,
        lineCount: 3,
        title: 'Resource Title',
      },
      xml: '<document></document>',
    });
  });

  it('isolates fallback page content by conversation key', async () => {
    const runtime = new ReadyDocsAgentRuntime();

    runtime.setScopedFallbackDocContentContext({
      context: {
        markdown: '# Topic A\n\nOnly visible in topic A.',
        metadata: { title: 'Topic A' },
        xml: '<topic-a />',
      },
      contextKey: 'page_agent-1_topic-a',
      docId: 'file-topic-a',
    });

    expect(runtime.getScopedDocContentContext('both', 'page_agent-1_topic-a')).toEqual({
      markdown: '# Topic A\n\nOnly visible in topic A.',
      metadata: {
        charCount: 35,
        lineCount: 3,
        title: 'Topic A',
      },
      xml: '<topic-a />',
    });

    expect(runtime.getScopedDocContentContext('both', 'page_agent-1_topic-b')).toEqual({
      markdown: '',
      metadata: {
        charCount: 0,
        lineCount: 0,
        title: 'Untitled',
      },
      xml: '',
    });

    await expect(
      runtime.getScopedDocContent({ format: 'both' }, 'page_agent-1_topic-a'),
    ).resolves.toEqual({
      charCount: 35,
      documentId: 'file-topic-a',
      lineCount: 3,
      markdown: '# Topic A\n\nOnly visible in topic A.',
      title: 'Topic A',
      xml: '<topic-a />',
    });
  });
});
