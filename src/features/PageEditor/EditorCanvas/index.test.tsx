/**
 * @vitest-environment happy-dom
 */
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EditorCanvas from './index';

const { performMetaSaveMock, sharedEditorCanvasMock, storeState } = vi.hoisted(() => {
  const performMetaSave = vi.fn().mockResolvedValue(undefined);
  const sharedEditorCanvas = vi.fn(() => null);

  return {
    performMetaSaveMock: performMetaSave,
    sharedEditorCanvasMock: sharedEditorCanvas,
    storeState: {
      documentId: 'doc-1',
      editor: undefined,
      performMetaSave,
    },
  };
});

vi.mock('@/features/EditorCanvas', () => ({
  EditorCanvas: (props: any) => sharedEditorCanvasMock(props),
}));

vi.mock('../store', () => ({
  usePageEditorStore: Object.assign(
    vi.fn((selector: any) => selector(storeState)),
    {
      getState: vi.fn(() => storeState),
    },
  ),
}));

vi.mock('./useAskCopilotItem', () => ({
  useAskCopilotItem: vi.fn(() => []),
}));

vi.mock('./useSlashItems', () => ({
  useSlashItems: vi.fn(() => []),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('PageEditor EditorCanvas', () => {
  beforeEach(() => {
    sharedEditorCanvasMock.mockClear();
    performMetaSaveMock.mockClear();
  });

  it('flushes page meta before route-leave autosave', async () => {
    render(<EditorCanvas />);

    const props = sharedEditorCanvasMock.mock.calls.at(-1)?.[0];

    expect(props?.unsavedChangesGuard?.beforeAutoSave).toEqual(expect.any(Function));

    await props.unsavedChangesGuard.beforeAutoSave();

    expect(performMetaSaveMock).toHaveBeenCalledTimes(1);
  });
});
