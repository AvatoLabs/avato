/**
 * Lobe Page Agent Executor
 *
 * Creates and exports the PageAgentExecutor instance for registration.
 * Also exports the runtime for editor instance injection.
 */
import { PageAgentExecutor } from '@lobechat/builtin-tool-page-agent/executor';
import {
  EditorRuntime,
  type GetPageContentArgs,
  type GetPageContentRuntimeResult,
  type InitDocumentArgs,
  type InitPageRuntimeResult,
  type ModifyNodesArgs,
  type ModifyNodesRuntimeResult,
  type ReplaceTextArgs,
  type ReplaceTextRuntimeResult,
} from '@lobechat/editor-runtime';
import type { PageContentContext } from '@lobechat/prompts';
import { type IEditor } from '@lobehub/editor';

const EDITOR_READY_TIMEOUT_MS = 5000;
const DEFAULT_FALLBACK_CONTEXT_KEY = '__default__';

interface ScopedFallbackPageContext {
  context: PageContentContext;
  docId?: string;
}

export class ReadyPageAgentRuntime extends EditorRuntime {
  private currentEditor: IEditor | null = null;
  private editorReadyPromise: Promise<void> | null = null;
  private editorReadyTimeoutMs: number;
  private activeFallbackContextKey?: string;
  private fallbackPageContentContexts = new Map<string, ScopedFallbackPageContext>();
  private readyListener?: { editor: IEditor; handler: (editor: unknown) => void };
  private titleGetterRef: (() => string) | null = null;

  constructor(editorReadyTimeoutMs = EDITOR_READY_TIMEOUT_MS) {
    super();
    this.editorReadyTimeoutMs = editorReadyTimeoutMs;
  }

  override setEditor(editor: IEditor | null) {
    this.clearReadyListener();
    this.currentEditor = editor;
    super.setEditor(editor);

    if (!editor) {
      this.editorReadyPromise = null;
      return;
    }

    if (editor.getLexicalEditor()) {
      this.editorReadyPromise = Promise.resolve();
      return;
    }

    this.editorReadyPromise = new Promise<void>((resolve) => {
      const handler = () => {
        this.clearReadyListener();
        resolve();
      };

      this.readyListener = { editor, handler };
      editor.once('initialized', handler);
    });
  }

  override setTitleHandlers(
    setter: ((title: string) => void) | null,
    getter: (() => string) | null,
  ) {
    this.titleGetterRef = getter;
    super.setTitleHandlers(setter, getter);
  }

  setFallbackPageContentContext(context?: PageContentContext | null) {
    this.setScopedFallbackPageContentContext({
      context,
      contextKey: DEFAULT_FALLBACK_CONTEXT_KEY,
    });
  }

  setScopedFallbackPageContentContext({
    context,
    contextKey,
    docId,
  }: {
    context?: PageContentContext | null;
    contextKey: string;
    docId?: string;
  }) {
    if (!context) {
      this.fallbackPageContentContexts.delete(contextKey);

      if (this.activeFallbackContextKey === contextKey) {
        this.activeFallbackContextKey = Array.from(this.fallbackPageContentContexts.keys()).at(-1);
      }

      return;
    }

    this.fallbackPageContentContexts.set(contextKey, { context, docId });
    this.activeFallbackContextKey = contextKey;
  }

  override async initPage(args: InitDocumentArgs): Promise<InitPageRuntimeResult> {
    await this.waitForEditorReady();
    return super.initPage(args);
  }

  override async getPageContent(args: GetPageContentArgs): Promise<GetPageContentRuntimeResult> {
    return this.getScopedPageContent(args);
  }

  async getScopedPageContent(
    args: GetPageContentArgs,
    contextKey?: string,
  ): Promise<GetPageContentRuntimeResult> {
    const fallback = this.getFallbackPageContentContext(contextKey);

    if (fallback && !this.isEditorReady()) {
      const context = this.pickFallbackContext(fallback.context, args.format);

      return {
        charCount: context.metadata.charCount,
        documentId: fallback.docId || this.getCurrentDocId() || 'current',
        lineCount: context.metadata.lineCount,
        markdown: context.markdown,
        title: context.metadata.title,
        xml: context.xml,
      };
    }

    await this.waitForEditorReady();
    return super.getPageContent(args);
  }

  override getPageContentContext(format: 'xml' | 'markdown' | 'both' = 'both'): PageContentContext {
    return this.getScopedPageContentContext(format);
  }

  getScopedPageContentContext(
    format: 'xml' | 'markdown' | 'both' = 'both',
    contextKey?: string,
  ): PageContentContext {
    const fallback = this.getFallbackPageContentContext(contextKey);

    if (fallback && !this.isEditorReady()) {
      return this.pickFallbackContext(fallback.context, format);
    }

    if (!this.isEditorReady()) {
      return this.createPendingContext(format);
    }

    return super.getPageContentContext(format);
  }

  override async modifyNodes(args: ModifyNodesArgs): Promise<ModifyNodesRuntimeResult> {
    await this.waitForEditorReady();
    return super.modifyNodes(args);
  }

  override async replaceText(args: ReplaceTextArgs): Promise<ReplaceTextRuntimeResult> {
    await this.waitForEditorReady();
    return super.replaceText(args);
  }

  private clearReadyListener() {
    if (!this.readyListener) return;

    this.readyListener.editor.off('initialized', this.readyListener.handler);
    this.readyListener = undefined;
  }

  private getFallbackPageContentContext(contextKey?: string) {
    if (contextKey) return this.fallbackPageContentContexts.get(contextKey);

    if (this.activeFallbackContextKey) {
      const activeFallback = this.fallbackPageContentContexts.get(this.activeFallbackContextKey);
      if (activeFallback) return activeFallback;
    }

    return this.fallbackPageContentContexts.get(DEFAULT_FALLBACK_CONTEXT_KEY);
  }

  private pickFallbackContext(fallback: PageContentContext, format: 'xml' | 'markdown' | 'both') {
    const markdown = fallback.markdown || '';
    const xml = fallback.xml || '';

    const context: PageContentContext = {
      metadata: {
        charCount: fallback.metadata?.charCount ?? markdown.length,
        lineCount: fallback.metadata?.lineCount ?? (markdown ? markdown.split('\n').length : 0),
        title: fallback.metadata?.title || this.titleGetterRef?.() || 'Untitled',
      },
    };

    if (format === 'markdown' || format === 'both') {
      context.markdown = markdown;
    }

    if (format === 'xml' || format === 'both') {
      context.xml = xml;
    }

    return context;
  }

  private createPendingContext(format: 'xml' | 'markdown' | 'both'): PageContentContext {
    const context: PageContentContext = {
      metadata: {
        title: this.titleGetterRef?.() || 'Untitled',
      },
    };

    if (format === 'markdown' || format === 'both') {
      context.markdown = '';
      context.metadata.charCount = 0;
      context.metadata.lineCount = 0;
    }

    if (format === 'xml' || format === 'both') {
      context.xml = '';
    }

    return context;
  }

  private isEditorReady() {
    return !!this.currentEditor?.getLexicalEditor();
  }

  private async waitForEditorReady() {
    if (!this.currentEditor) {
      throw new Error('Editor not initialized. Please set the editor instance first.');
    }

    if (this.isEditorReady()) return;

    if (!this.editorReadyPromise) {
      throw new Error('Editor not initialized. Please set the editor instance first.');
    }

    await Promise.race([
      this.editorReadyPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(
            new Error('Page editor is still initializing. Please retry once the editor is ready.'),
          );
        }, this.editorReadyTimeoutMs);
      }),
    ]);
  }
}

// Create singleton instance of the runtime
export const pageAgentRuntime = new ReadyPageAgentRuntime();

// Create executor instance with the runtime
export const pageAgentExecutor = new PageAgentExecutor(pageAgentRuntime);
