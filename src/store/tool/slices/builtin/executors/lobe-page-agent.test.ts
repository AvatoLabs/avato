import { describe, expect, it, vi } from 'vitest';

import { ReadyPageAgentRuntime } from './lobe-page-agent';

describe('ReadyPageAgentRuntime', () => {
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

    const runtime = new ReadyPageAgentRuntime();
    runtime.setEditor(editor as any);

    const pending = runtime.initPage({ markdown: 'Hello world' });

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

    const runtime = new ReadyPageAgentRuntime();
    runtime.setTitleHandlers(null, () => 'Draft Title');
    runtime.setEditor(editor as any);

    expect(runtime.getPageContentContext('both')).toEqual({
      markdown: '',
      metadata: {
        charCount: 0,
        lineCount: 0,
        title: 'Draft Title',
      },
      xml: '',
    });
  });
});
