/**
 * @vitest-environment happy-dom
 */
import { render, waitFor } from '@testing-library/react';
import type * as ReactTypes from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DocumentIdMode from './DocumentIdMode';
import { type DocumentIdModeProps } from './DocumentIdMode';

const { guardPropsRef, storeState, storeGetState, useDocumentStoreMock } = vi.hoisted(() => {
  const state = {
    flushSave: vi.fn(),
    onEditorInit: vi.fn(() => Promise.resolve()),
    performSave: vi.fn(() => Promise.resolve()),
    useFetchDocument: vi.fn(() => ({ error: undefined })),
  };
  const getState = {
    documents: {},
  };

  const guardProps = { current: undefined as any };

  const store = Object.assign(
    vi.fn((selector: (input: typeof state) => unknown) => selector(state)),
    {
      getState: vi.fn(() => getState),
    },
  );

  return {
    guardPropsRef: guardProps,
    storeGetState: getState,
    storeState: state,
    useDocumentStoreMock: store,
  };
});

vi.mock('@/hooks/useHotkeys', () => ({
  useSaveDocumentHotkey: vi.fn(),
}));

vi.mock('@/store/document', () => ({
  useDocumentStore: useDocumentStoreMock,
}));

vi.mock('@/store/document/slices/editor', () => ({
  editorSelectors: {
    isDirty: vi.fn(() => () => false),
    isDocumentLoading: vi.fn(() => () => false),
  },
}));

vi.mock('@lobehub/ui', () => ({
  Alert: () => null,
  Skeleton: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock('zustand-utils', () => ({
  createStoreUpdater: () => () => undefined,
}));

vi.mock('./UnsavedChangesGuard', () => ({
  default: (props: any) => {
    guardPropsRef.current = props;
    return null;
  },
}));

vi.mock('./InternalEditor', async () => {
  const React = await vi.importActual<typeof ReactTypes>('react');

  const MockInternalEditor = ({
    editor,
    onInit,
  }: {
    editor: unknown;
    onInit?: (editor: unknown) => void;
  }) => {
    React.useEffect(() => {
      onInit?.(editor);
    }, [editor, onInit]);

    return null;
  };

  return { default: MockInternalEditor };
});

describe('DocumentIdMode', () => {
  beforeEach(() => {
    guardPropsRef.current = undefined;
    storeGetState.documents = {};
    storeState.flushSave.mockReset();
    storeState.onEditorInit.mockReset().mockResolvedValue(undefined);
    storeState.performSave.mockReset().mockResolvedValue(undefined);
    storeState.useFetchDocument.mockReset().mockReturnValue({ error: undefined });
  });

  it('should only initialize the current document once on first mount', async () => {
    const editor = {
      getLexicalEditor: vi.fn(() => ({})),
    } as unknown as NonNullable<DocumentIdModeProps['editor']>;

    render(<DocumentIdMode documentId="doc-1" editor={editor} />);

    expect(storeState.useFetchDocument).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({
        autoSave: true,
        editor,
        sourceType: 'page',
        syncPolicy: 'once',
      }),
    );

    expect(storeState.onEditorInit).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(storeState.onEditorInit).toHaveBeenCalledTimes(1);
    });

    expect(storeState.onEditorInit).toHaveBeenCalledWith(editor);
  });

  it('should throw the last save error when route-leave autosave still leaves the doc dirty', async () => {
    const editor = {
      getLexicalEditor: vi.fn(() => ({})),
    } as unknown as NonNullable<DocumentIdModeProps['editor']>;

    storeGetState.documents = {
      'doc-1': {
        isDirty: true,
        lastSaveError: 'save failed',
      },
    };

    render(
      <DocumentIdMode
        documentId="doc-1"
        editor={editor}
        unsavedChangesGuard={{ enabled: true, message: 'unsaved' }}
      />,
    );

    await expect(guardPropsRef.current.onAutoSave()).rejects.toThrow('save failed');
    expect(storeState.performSave).toHaveBeenCalledWith('doc-1');
  });
});
