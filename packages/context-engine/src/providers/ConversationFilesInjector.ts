import type { FileContent } from '@lobechat/prompts';
import { promptConversationFiles } from '@lobechat/prompts';
import debug from 'debug';

import { BaseFirstUserContentProvider } from '../base/BaseFirstUserContentProvider';
import type { PipelineContext, ProcessorOptions } from '../types';

const log = debug('context-engine:provider:ConversationFilesInjector');

export interface ConversationFilesInjectorConfig {
  fileContents?: FileContent[];
}

export class ConversationFilesInjector extends BaseFirstUserContentProvider {
  readonly name = 'ConversationFilesInjector';

  constructor(
    private config: ConversationFilesInjectorConfig,
    options: ProcessorOptions = {},
  ) {
    super(options);
  }

  protected buildContent(_context: PipelineContext): string | null {
    const fileContents = this.config.fileContents || [];
    const formattedContent = promptConversationFiles(fileContents);

    if (!formattedContent) {
      log('No conversation files to inject');
      return null;
    }

    log('Conversation files prepared: %d file(s)', fileContents.length);

    return formattedContent;
  }

  protected async doProcess(context: PipelineContext): Promise<PipelineContext> {
    const result = await super.doProcess(context);
    const fileContents = this.config.fileContents || [];

    if (fileContents.length > 0) {
      result.metadata.conversationFilesCount = fileContents.length;
      result.metadata.conversationFilesInjected = true;
    }

    return result;
  }
}
