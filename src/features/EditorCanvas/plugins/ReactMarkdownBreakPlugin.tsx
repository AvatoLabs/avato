'use client';

import {
  IMarkdownShortCutService,
  MARKDOWN_READER_LEVEL_HIGH,
  MarkdownPlugin,
  useLexicalComposerContext,
} from '@lobehub/editor';
import { useLayoutEffect } from 'react';

const BREAK_TAG_REGEXP = /^<\s*br\s*(?:\/\s*)?>$/i;

interface MarkdownShortcutService {
  registerMarkdownReader: (
    type: string,
    reader: (node: { value?: string }) => { type: 'linebreak'; version: 1 } | false,
    level?: number,
  ) => void;
}

class MarkdownBreakPlugin {
  static pluginName = 'MarkdownBreakPlugin';

  private readonly kernel: {
    requireService: (serviceId: typeof IMarkdownShortCutService) => MarkdownShortcutService | null;
  };

  constructor(kernel: {
    requireService: (serviceId: typeof IMarkdownShortCutService) => MarkdownShortcutService | null;
  }) {
    this.kernel = kernel;
  }

  onInit() {
    const markdownService = this.kernel.requireService(IMarkdownShortCutService);
    if (!markdownService) return;

    markdownService.registerMarkdownReader(
      'html',
      (node: { value?: string }) => {
        if (!node.value || !BREAK_TAG_REGEXP.test(node.value.trim())) return false;

        return { type: 'linebreak', version: 1 };
      },
      MARKDOWN_READER_LEVEL_HIGH,
    );
  }
}

const ReactMarkdownBreakPlugin = () => {
  const [editor] = useLexicalComposerContext();

  useLayoutEffect(() => {
    editor.registerPlugin(MarkdownPlugin);
    editor.registerPlugin(MarkdownBreakPlugin);
  }, [editor]);

  return null;
};

ReactMarkdownBreakPlugin.displayName = 'ReactMarkdownBreakPlugin';

export default ReactMarkdownBreakPlugin;
