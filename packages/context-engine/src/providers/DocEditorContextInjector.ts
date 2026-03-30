import type { DocContentContext } from '@lobechat/prompts';
import { formatDocContentContext } from '@lobechat/prompts';
import debug from 'debug';

import { BaseLastUserContentProvider } from '../base/BaseLastUserContentProvider';
import type { PipelineContext, ProcessorOptions } from '../types';

const log = debug('context-engine:provider:DocEditorContextInjector');

export interface DocEditorContextInjectorConfig {
  /**
   * Doc content context to inject
   * Contains markdown, xml, and metadata for the current doc
   */
  docContentContext?: DocContentContext;
  /** Whether the doc editor context is enabled */
  enabled?: boolean;
}

/**
 * Doc editor context injector
 * Responsible for injecting the current doc context at the end of the last user message.
 * This ensures the model receives the most up-to-date document state.
 *
 * Note: Doc selections (user-selected text regions) are handled separately by
 * DocSelectionsInjector, which injects selections into each user message that has them.
 */
export class DocEditorContextInjector extends BaseLastUserContentProvider {
  readonly name = 'DocEditorContextInjector';

  constructor(
    private config: DocEditorContextInjectorConfig,
    options: ProcessorOptions = {},
  ) {
    super(options);
  }

  protected async doProcess(context: PipelineContext): Promise<PipelineContext> {
    log('doProcess called');
    log('config.enabled:', this.config.enabled);

    const clonedContext = this.cloneContext(context);

    // Check if we have doc content to inject.
    const hasDocContent = this.config.enabled && this.config.docContentContext;

    if (!hasDocContent) {
      log('No docContentContext, skipping injection');
      return this.markAsExecuted(clonedContext);
    }

    // Find the last user message index
    const lastUserIndex = this.findLastUserMessageIndex(clonedContext.messages);

    log('Last user message index:', lastUserIndex);

    if (lastUserIndex === -1) {
      log('No user messages found, skipping injection');
      return this.markAsExecuted(clonedContext);
    }

    // Format doc content.
    const formattedContent = formatDocContentContext(this.config.docContentContext!);

    if (!formattedContent) {
      log('No content to inject after formatting');
      return this.markAsExecuted(clonedContext);
    }

    log('Doc content formatted, length:', formattedContent.length);

    // Check if system context wrapper already exists
    // If yes, only insert context block; if no, use full wrapper
    const hasExistingWrapper = this.hasExistingSystemContext(clonedContext);
    const contentToAppend = hasExistingWrapper
      ? this.createContextBlock(formattedContent, 'current_doc_context')
      : this.wrapWithSystemContext(formattedContent, 'current_doc_context');

    this.appendToLastUserMessage(clonedContext, contentToAppend);

    // Update metadata
    clonedContext.metadata.docEditorContextInjected = true;

    log('Doc editor context appended to last user message');

    return this.markAsExecuted(clonedContext);
  }
}
