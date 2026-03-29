import type { FileContent, SourceSetInfo } from '@lobechat/prompts';
import { promptAgentSources } from '@lobechat/prompts';
import debug from 'debug';

import { BaseFirstUserContentProvider } from '../base/BaseFirstUserContentProvider';
import type { PipelineContext, ProcessorOptions } from '../types';

const log = debug('context-engine:provider:KnowledgeInjector');

export interface KnowledgeInjectorConfig {
  /** File contents to inject */
  fileContents?: FileContent[];
  /** Source sets to inject */
  sourceSets?: SourceSetInfo[];
}

/**
 * Knowledge Injector
 * Responsible for injecting agent sources (files and source sets) into context
 * before the first user message
 */
export class KnowledgeInjector extends BaseFirstUserContentProvider {
  readonly name = 'KnowledgeInjector';

  constructor(
    private config: KnowledgeInjectorConfig,
    options: ProcessorOptions = {},
  ) {
    super(options);
  }

  protected buildContent(_context: PipelineContext): string | null {
    const fileContents = this.config.fileContents || [];
    const sourceSets = this.config.sourceSets || [];

    // Generate unified knowledge prompt
    const formattedContent = promptAgentSources({ fileContents, sourceSets });

    if (!formattedContent) {
      log('No knowledge to inject');
      return null;
    }

    log(`Knowledge prepared: ${fileContents.length} file(s), ${sourceSets.length} source set(s)`);

    return formattedContent;
  }

  protected async doProcess(context: PipelineContext): Promise<PipelineContext> {
    const result = await super.doProcess(context);

    // Update metadata
    const fileContents = this.config.fileContents || [];
    const sourceSets = this.config.sourceSets || [];

    if (fileContents.length > 0 || sourceSets.length > 0) {
      result.metadata.knowledgeInjected = true;
      result.metadata.filesCount = fileContents.length;
      result.metadata.sourceSetsCount = sourceSets.length;
    }

    return result;
  }
}
