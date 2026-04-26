import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { documentService } from '@/services/document';

import { useDocumentStore } from '../../store';

// Mock services
vi.mock('@/services/document', () => ({
  documentService: {
    updateDocument: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/notebook', () => ({
  notebookService: {
    updateDocument: vi.fn().mockResolvedValue({}),
  },
}));

// Create mock editor
const createMockEditor = () => ({
  getDocument: vi.fn((type: string) => {
    if (type === 'markdown') return '# Test';
    if (type === 'json') return { type: 'doc' };
    return null;
  }),
  setDocument: vi.fn(),
});

describe('DocumentStore - Editor Actions', () => {
beforeEach(() => {
    vi.mocked(documentService.updateDocument).mockReset().mockResolvedValue(undefined);

    // Reset store state before each test
    const { result } = renderHook(() => useDocumentStore());
    act(() => {
      // Clear all documents and reset editor
      const state = result.current;
      Object.keys(state.documents).forEach((id) => {
        state.closeDocument(id);
      });
      state.setEditorState(undefined);
    });
    // Reset editor separately (store internal state)
    useDocumentStore.setState({ editor: undefined });
  });

  describe('initDocumentWithEditor', () => {
    it('should store document state without loading into editor', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Hello World',
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'notebook',
          topicId: 'topic-1',
        });
      });

      // Should store state
      expect(result.current.activeDocumentId).toBe('doc-1');
      expect(result.current.documents['doc-1']).toMatchObject({
        content: '# Hello World',
        isDirty: false,
        sourceType: 'notebook',
        topicId: 'topic-1',
      });
      // Should NOT call setDocument - that happens in onEditorInit
      expect(mockEditor.setDocument).not.toHaveBeenCalled();
    });

    it('should init a new page document', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          content: 'Page content',
          documentId: 'page-1',
          editor: mockEditor,
          sourceType: 'page',
        });
      });

      expect(result.current.activeDocumentId).toBe('page-1');
      expect(result.current.documents['page-1']).toMatchObject({
        content: 'Page content',
        sourceType: 'page',
      });
    });

    it('should update existing document when init with same ID', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          content: 'Original content',
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'notebook',
          topicId: 'topic-1',
        });
      });

      act(() => {
        result.current.initDocumentWithEditor({
          content: 'Updated content',
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'notebook',
          topicId: 'topic-1',
        });
      });

      expect(result.current.documents['doc-1'].content).toBe('Updated content');
    });

    it('should store editorData in state', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;
      const editorData = { type: 'doc', content: [] };

      act(() => {
        result.current.initDocumentWithEditor({
          documentId: 'doc-1',
          editor: mockEditor,
          editorData,
          sourceType: 'page',
        });
      });

      expect(result.current.documents['doc-1'].editorData).toEqual(editorData);
      // Should NOT call setDocument - that happens in onEditorInit
      expect(mockEditor.setDocument).not.toHaveBeenCalled();
    });

    it('should preserve lastUpdatedTime from fetched document state', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          content: 'Page content',
          documentId: 'doc-1',
          editor: mockEditor,
          lastUpdatedTime: '2026-03-28T12:00:00.000Z',
          sourceType: 'page',
        });
      });

      expect(result.current.documents['doc-1'].lastUpdatedTime?.toISOString()).toBe(
        '2026-03-28T12:00:00.000Z',
      );
    });
  });

  describe('onEditorInit', () => {
    it('should load markdown content into editor', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      // First init document with content
      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Hello World',
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'notebook',
        });
      });

      // Then call onEditorInit
      act(() => {
        result.current.onEditorInit(mockEditor);
      });

      expect(mockEditor.setDocument).toHaveBeenCalledWith('markdown', '# Hello World');
    });

    it('should decode encoded br tags before loading markdown into editor', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          content: '| Cost |\\n| --- |\\n| 22,500&lt;br&gt;(4,500/人) |',
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'page',
        });
      });

      act(() => {
        result.current.onEditorInit(mockEditor);
      });

      expect(mockEditor.setDocument).toHaveBeenCalledWith(
        'markdown',
        '| Cost |\\n| --- |\\n| 22,500<br />(4,500/人) |',
      );
    });

    it('should load editorData as json into editor', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;
      const editorData = { type: 'doc', content: [] };

      act(() => {
        result.current.initDocumentWithEditor({
          documentId: 'doc-1',
          editor: mockEditor,
          editorData,
          sourceType: 'page',
        });
      });

      act(() => {
        result.current.onEditorInit(mockEditor);
      });

      expect(mockEditor.setDocument).toHaveBeenCalledWith('json', JSON.stringify(editorData));
    });

    it('should not call setDocument when content is empty to avoid editor error', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'page',
        });
      });

      act(() => {
        result.current.onEditorInit(mockEditor);
      });

      // setDocument should NOT be called for empty content
      // This prevents "setEditorState: the editor state is empty" error
      expect(mockEditor.setDocument).not.toHaveBeenCalled();
    });
  });

  describe('closeDocument', () => {
    it('should close a document and remove it from state', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'notebook',
          topicId: 'topic-1',
        });
      });

      expect(result.current.documents['doc-1']).toBeDefined();

      act(() => {
        result.current.closeDocument('doc-1');
      });

      expect(result.current.documents['doc-1']).toBeUndefined();
      expect(result.current.activeDocumentId).toBeUndefined();
    });

    it('should not affect other documents when closing one', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'notebook',
          topicId: 'topic-1',
        });
        result.current.initDocumentWithEditor({
          documentId: 'doc-2',
          editor: mockEditor,
          sourceType: 'notebook',
          topicId: 'topic-2',
        });
      });

      act(() => {
        result.current.closeDocument('doc-1');
      });

      expect(result.current.documents['doc-1']).toBeUndefined();
      expect(result.current.documents['doc-2']).toBeDefined();
    });
  });

  describe('markDirty', () => {
    it('should mark document as dirty', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'notebook',
          topicId: 'topic-1',
        });
      });

      expect(result.current.documents['doc-1'].isDirty).toBe(false);

      act(() => {
        result.current.markDirty('doc-1');
      });

      expect(result.current.documents['doc-1'].isDirty).toBe(true);
    });
  });

  describe('handleContentChange', () => {
    it('should mark document dirty when editorData changes even if markdown is unchanged', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = {
        getDocument: vi.fn((type: string) => {
          if (type === 'markdown') return '# Test';
          if (type === 'json') return { type: 'doc', version: 2 };
          return null;
        }),
        setDocument: vi.fn(),
      } as any;

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Test',
          documentId: 'doc-1',
          editor: mockEditor,
          editorData: { type: 'doc', version: 1 },
          sourceType: 'page',
        });
      });

      expect(result.current.documents['doc-1'].isDirty).toBe(false);

      act(() => {
        result.current.handleContentChange();
      });

      expect(result.current.documents['doc-1']).toMatchObject({
        content: '# Test',
        editorData: { type: 'doc', version: 2 },
        isDirty: true,
      });
    });
  });

  describe('setEditorState', () => {
    it('should set editor state', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditorState = { isBold: true } as any;

      act(() => {
        result.current.setEditorState(mockEditorState);
      });

      expect(result.current.editorState).toBe(mockEditorState);
    });
  });

  describe('getEditorContent', () => {
    it('should return null when no editor', () => {
      const { result } = renderHook(() => useDocumentStore());

      const content = result.current.getEditorContent();

      expect(content).toBeNull();
    });

    it('should return content from editor', () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = {
        getDocument: vi.fn((type: string) => {
          if (type === 'markdown') return '# Test';
          if (type === 'json') return { type: 'doc' };
          return null;
        }),
        setDocument: vi.fn(),
      } as any;

      act(() => {
        result.current.initDocumentWithEditor({
          documentId: 'doc-1',
          editor: mockEditor,
          sourceType: 'page',
        });
      });

      const content = result.current.getEditorContent();

      expect(content).toEqual({
        editorData: { type: 'doc' },
        markdown: '# Test',
      });
    });

    it('should fall back to stored document content when no editor is mounted', () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Stored',
          documentId: 'doc-1',
          editorData: { type: 'snapshot' },
          sourceType: 'page',
        });
      });

      expect(result.current.getEditorContent()).toEqual({
        editorData: { type: 'snapshot' },
        markdown: '# Stored',
      });
    });
  });

  describe('syncExternalDocumentContent', () => {
    it('should update markdown content and preserve autosave metadata', () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Test',
          documentId: 'doc-1',
          editorData: { type: 'snapshot', version: 1 },
          sourceType: 'page',
        });
      });

      act(() => {
        result.current.syncExternalDocumentContent('doc-1', {
          content: '# Updated',
          editorData: { type: 'snapshot', version: 2 },
        });
      });

      expect(result.current.documents['doc-1']).toMatchObject({
        content: '# Updated',
        editorData: { type: 'snapshot', version: 2 },
        isDirty: true,
      });
    });
  });

  describe('performSave', () => {
    it('should save stored content when no editor instance is mounted', async () => {
      const { result } = renderHook(() => useDocumentStore());

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Persisted',
          documentId: 'doc-1',
          editorData: { type: 'snapshot', version: 1 },
          sourceType: 'page',
        });
        result.current.syncExternalDocumentContent('doc-1', {
          content: '# Persisted updated',
          editorData: { type: 'snapshot', version: 2 },
        });
      });

      await act(async () => {
        await result.current.performSave('doc-1');
      });

      expect(documentService.updateDocument).toHaveBeenCalledWith({
        content: '# Persisted updated',
        editorData: JSON.stringify({ type: 'snapshot', version: 2 }),
        id: 'doc-1',
        metadata: undefined,
        title: undefined,
      });
      expect(result.current.documents['doc-1']).toMatchObject({
        content: '# Persisted updated',
        editorData: { type: 'snapshot', version: 2 },
        isDirty: false,
      });
    });

    it('should save stored content when saving a non-active document', async () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Original',
          documentId: 'doc-1',
          editorData: { type: 'snapshot', version: 1 },
          sourceType: 'page',
        });
        result.current.syncExternalDocumentContent('doc-1', {
          content: '# Stored doc-1',
          editorData: { type: 'snapshot', version: 2 },
        });
        result.current.initDocumentWithEditor({
          content: '# Active doc-2',
          documentId: 'doc-2',
          editor: mockEditor,
          sourceType: 'page',
        });
      });

      await act(async () => {
        await result.current.performSave('doc-1');
      });

      expect(documentService.updateDocument).toHaveBeenCalledWith({
        content: '# Stored doc-1',
        editorData: JSON.stringify({ type: 'snapshot', version: 2 }),
        id: 'doc-1',
        metadata: undefined,
        title: undefined,
      });
    });

    it('should retry transient editor snapshot errors before failing the save', async () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;
      let jsonReadCount = 0;

      mockEditor.getDocument.mockImplementation((type: string) => {
        if (type === 'markdown') return '# Stable content';
        if (type === 'json') {
          jsonReadCount += 1;

          if (jsonReadCount === 1) {
            throw new Error('Expected node root to have a parent.');
          }

          return { type: 'snapshot', version: 2 };
        }

        return null;
      });

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Original',
          documentId: 'doc-1',
          editor: mockEditor,
          editorData: { type: 'snapshot', version: 1 },
          sourceType: 'page',
        });
        result.current.markDirty('doc-1');
      });

      await act(async () => {
        await result.current.performSave('doc-1');
      });

      expect(documentService.updateDocument).toHaveBeenCalledWith({
        content: '# Stable content',
        editorData: JSON.stringify({ type: 'snapshot', version: 2 }),
        id: 'doc-1',
        metadata: undefined,
        title: undefined,
      });
      expect(result.current.documents['doc-1']).toMatchObject({
        isDirty: false,
        lastSaveError: undefined,
        saveStatus: 'saved',
      });
    });

    it('should save markdown and clear editorData when json export stays broken', async () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      mockEditor.getDocument.mockImplementation((type: string) => {
        if (type === 'markdown') return '# Markdown survives';
        if (type === 'json') {
          throw new Error('Expected node root to have a parent.');
        }

        return null;
      });

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Original',
          documentId: 'doc-1',
          editor: mockEditor,
          editorData: { type: 'snapshot', version: 1 },
          sourceType: 'page',
        });
        result.current.markDirty('doc-1');
      });

      await act(async () => {
        await result.current.performSave('doc-1');
      });

      expect(documentService.updateDocument).toHaveBeenCalledWith({
        content: '# Markdown survives',
        editorData: 'null',
        id: 'doc-1',
        metadata: undefined,
        title: undefined,
      });
      expect(result.current.documents['doc-1']).toMatchObject({
        content: '# Markdown survives',
        editorData: null,
        isDirty: false,
        lastSavedEditorData: null,
        saveStatus: 'saved',
      });
    });

    it('should avoid reading live editor content when only metadata is being saved', async () => {
      const { result } = renderHook(() => useDocumentStore());
      const mockEditor = createMockEditor() as any;

      mockEditor.getDocument.mockImplementation((type: string) => {
        if (type === 'json') {
          throw new Error('Expected node root to have a parent.');
        }

        if (type === 'markdown') return '# Should not read';

        return null;
      });

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Stored content',
          documentId: 'doc-1',
          editor: mockEditor,
          editorData: { type: 'snapshot', version: 1 },
          sourceType: 'page',
        });
      });

      await act(async () => {
        await result.current.performSave('doc-1', { title: 'Updated title' });
      });

      expect(documentService.updateDocument).toHaveBeenCalledWith({
        content: '# Stored content',
        editorData: JSON.stringify({ type: 'snapshot', version: 1 }),
        id: 'doc-1',
        metadata: undefined,
        title: 'Updated title',
      });
    });

    it('should serialize concurrent saves for the same document', async () => {
      const { result } = renderHook(() => useDocumentStore());
      let resolveUpdate: (() => void) | undefined;

      vi.mocked(documentService.updateDocument).mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveUpdate = resolve;
          }),
      );

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Persisted',
          documentId: 'doc-1',
          editorData: { type: 'snapshot', version: 1 },
          sourceType: 'page',
        });
        result.current.syncExternalDocumentContent('doc-1', {
          content: '# Persisted updated',
          editorData: { type: 'snapshot', version: 2 },
        });
      });

      let firstSave: Promise<void> | undefined;
      let secondSave: Promise<void> | undefined;

      await act(async () => {
        firstSave = result.current.performSave('doc-1');
        secondSave = result.current.performSave('doc-1');
        await Promise.resolve();
      });

      expect(documentService.updateDocument).toHaveBeenCalledTimes(1);

      resolveUpdate?.();

      await act(async () => {
        await Promise.all([firstSave, secondSave]);
      });

      expect(documentService.updateDocument).toHaveBeenCalledTimes(1);
      expect(result.current.documents['doc-1']).toMatchObject({
        content: '# Persisted updated',
        editorData: { type: 'snapshot', version: 2 },
        isDirty: false,
      });
    });

    it('should persist the last save error when saving fails', async () => {
      const { result } = renderHook(() => useDocumentStore());

      vi.mocked(documentService.updateDocument).mockRejectedValueOnce(new Error('save failed'));

      act(() => {
        result.current.initDocumentWithEditor({
          content: '# Persisted',
          documentId: 'doc-1',
          editorData: { type: 'snapshot', version: 1 },
          sourceType: 'page',
        });
        result.current.syncExternalDocumentContent('doc-1', {
          content: '# Persisted updated',
          editorData: { type: 'snapshot', version: 2 },
        });
      });

      await act(async () => {
        await result.current.performSave('doc-1');
      });

      expect(result.current.documents['doc-1']).toMatchObject({
        isDirty: true,
        lastSaveError: 'save failed',
        saveStatus: 'idle',
      });
    });
  });

  describe('flushSave', () => {
    it('should not throw when no active document', () => {
      const { result } = renderHook(() => useDocumentStore());

      expect(() => {
        act(() => {
          result.current.flushSave();
        });
      }).not.toThrow();
    });
  });
});
