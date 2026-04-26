import { formatDocSelections } from '@lobechat/prompts';
import type { DocSelection } from '@lobechat/types';
import debug from 'debug';

import { BaseEveryUserContentProvider } from '../base/BaseEveryUserContentProvider';
import type { Message, ProcessorOptions } from '../types';

const log = debug('context-engine:provider:DocSelectionsInjector');

export interface DocSelectionsInjectorConfig {
  /** Whether doc selection injection is enabled */
  enabled?: boolean;
}

/**
 * Doc Selections Injector
 * Responsible for injecting doc selections into each user message that has them
 * Unlike DocEditorContextInjector which only injects to the last user message,
 * this processor handles selections attached to any user message in the conversation
 *
 * This injector runs BEFORE DocEditorContextInjector so that:
 * - Each user message with selections gets a SYSTEM CONTEXT wrapper
 * - DocEditorContextInjector can then reuse the wrapper for the last user message
 */
export class DocSelectionsInjector extends BaseEveryUserContentProvider {
  readonly name = 'DocSelectionsInjector';

  constructor(
    private config: DocSelectionsInjectorConfig = {},
    options: ProcessorOptions = {},
  ) {
    super(options);
  }

  protected buildContentForMessage(
    message: Message,
    index: number,
  ): { content: string; contextType: string } | null {
    // Skip if not enabled
    if (!this.config.enabled) {
      return null;
    }

    // Check if message has docSelections in metadata
    const docSelections = message.metadata?.docSelections as DocSelection[] | undefined;

    if (!docSelections || docSelections.length === 0) {
      return null;
    }

    // Format the selections
    const formattedSelections = formatDocSelections(docSelections);

    if (!formattedSelections) {
      return null;
    }

    log(`Building content for message at index ${index} with ${docSelections.length} selections`);

    return {
      content: formattedSelections,
      contextType: 'user_doc_selections',
    };
  }
}
