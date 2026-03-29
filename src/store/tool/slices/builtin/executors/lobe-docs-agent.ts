/**
 * Lobe Docs Agent Executor
 *
 * Creates and exports the DocsAgentExecutor instance for registration.
 * Also exports the runtime for editor instance injection.
 */
import { DocsAgentExecutor } from '@lobechat/builtin-tool-docs-agent/executor';
import {
  EditorRuntime,
  type GetDocContentArgs,
  type GetDocContentRuntimeResult,
  type InitDocRuntimeResult,
  type InitDocumentArgs,
  type ModifyNodesArgs,
  type ModifyNodesRuntimeResult,
  type ReplaceTextArgs,
  type ReplaceTextRuntimeResult,
} from '@lobechat/editor-runtime';
import type { DocContentContext } from '@lobechat/prompts';
import { type IEditor } from '@lobehub/editor';

const EDITOR_READY_TIMEOUT_MS = 5000;
const DEFAULT_FALLBACK_CONTEXT_KEY = '__default__';

interface ScopedFallbackDocContext {
  context: DocContentContext;
  docId?: string;
}

export class ReadyDocsAgentRuntime extends EditorRuntime {
  private currentEditor: IEditor | null = null;
  private editorReadyPromise: Promise<void> | null = null;
  private editorReadyTimeoutMs: number;
  private activeFallbackContextKey?: string;
  private fallbackDocContentContexts = new Map<string, ScopedFallbackDocContext>();
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

  setFallbackDocContentContext(context?: DocContentContext | null) {
    this.setScopedFallbackDocContentContext({
      context,
      contextKey: DEFAULT_FALLBACK_CONTEXT_KEY,
    });
  }

  setScopedFallbackDocContentContext({
    context,
    contextKey,
    docId,
  }: {
    context?: DocContentContext | null;
    contextKey: string;
    docId?: string;
  }) {
    if (!context) {
      this.fallbackDocContentContexts.delete(contextKey);

      if (this.activeFallbackContextKey === contextKey) {
        this.activeFallbackContextKey = Array.from(this.fallbackDocContentContexts.keys()).at(-1);
      }

      return;
    }

    this.fallbackDocContentContexts.set(contextKey, { context, docId });
    this.activeFallbackContextKey = contextKey;
  }

  override async initDoc(args: InitDocumentArgs): Promise<InitDocRuntimeResult> {
    await this.waitForEditorReady();
    return super.initDoc(args);
  }

  override async getDocContent(args: GetDocContentArgs): Promise<GetDocContentRuntimeResult> {
    return this.getScopedDocContent(args);
  }

  async getScopedDocContent(
    args: GetDocContentArgs,
    contextKey?: string,
  ): Promise<GetDocContentRuntimeResult> {
    const fallback = this.getFallbackDocContentContext(contextKey);

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
    return super.getDocContent(args);
  }

  override getDocContentContext(format: 'xml' | 'markdown' | 'both' = 'both'): DocContentContext {
    return this.getScopedDocContentContext(format);
  }

  getScopedDocContentContext(
    format: 'xml' | 'markdown' | 'both' = 'both',
    contextKey?: string,
  ): DocContentContext {
    const fallback = this.getFallbackDocContentContext(contextKey);

    if (fallback && !this.isEditorReady()) {
      return this.pickFallbackContext(fallback.context, format);
    }

    if (!this.isEditorReady()) {
      return this.createPendingContext(format);
    }

    return super.getDocContentContext(format);
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

  private getFallbackDocContentContext(contextKey?: string) {
    if (contextKey) return this.fallbackDocContentContexts.get(contextKey);

    if (this.activeFallbackContextKey) {
      const activeFallback = this.fallbackDocContentContexts.get(this.activeFallbackContextKey);
      if (activeFallback) return activeFallback;
    }

    return this.fallbackDocContentContexts.get(DEFAULT_FALLBACK_CONTEXT_KEY);
  }

  private pickFallbackContext(fallback: DocContentContext, format: 'xml' | 'markdown' | 'both') {
    const markdown = fallback.markdown || '';
    const xml = fallback.xml || '';

    const context: DocContentContext = {
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

  private createPendingContext(format: 'xml' | 'markdown' | 'both'): DocContentContext {
    const context: DocContentContext = {
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
            new Error('Doc editor is still initializing. Please retry once the editor is ready.'),
          );
        }, this.editorReadyTimeoutMs);
      }),
    ]);
  }
}

// Create singleton instance of the runtime
export const docsAgentRuntime = new ReadyDocsAgentRuntime();

// Create executor instance with the runtime
export const docsAgentExecutor = new DocsAgentExecutor(docsAgentRuntime);
