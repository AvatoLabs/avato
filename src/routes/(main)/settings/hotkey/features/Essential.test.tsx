/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Essential from './Essential';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockSetSettings = vi.hoisted(() => vi.fn());
const formApi = vi.hoisted(() => ({
  setFieldValue: vi.fn(),
  setFieldsValue: vi.fn(),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
    }),
  },
}));

vi.mock('@lobehub/ui', () => {
  const Form = ({ items }: any) => (
    <div>
      {items?.flatMap((group: any, groupIndex: number) =>
        group.children?.map((item: any, itemIndex: number) => (
          <div key={`${groupIndex}-${itemIndex}`}>{item.children}</div>
        )),
      )}
    </div>
  );

  Form.useForm = () => [formApi];

  return {
    Form,
    HotkeyInput: ({ onClear }: any) => (
      <button
        type="button"
        onClick={() => {
          void onClear();
        }}
      >
        clear-hotkey
      </button>
    ),
    Icon: () => null,
    Skeleton: () => null,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/const/hotkeys', () => ({
  HOTKEYS_REGISTRATION: [
    {
      group: 'essential',
      id: 'togglePanel',
      keys: 'Meta+Shift+P',
      nonEditable: false,
    },
  ],
}));

vi.mock('@/locales/default/hotkey', () => ({
  default: {
    'togglePanel.desc': 'Toggle panel',
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) =>
    selector({
      hotkey: {
        togglePanel: 'Meta+Shift+P',
      },
      isUserStateInit: true,
      setSettings: mockSetSettings,
    }),
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentSettings: (state: any) => state,
  },
}));

describe('Essential hotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and restores the cleared binding when removal fails', async () => {
    const error = new Error('clear failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSetSettings.mockRejectedValue(error);

    render(<Essential />);

    fireEvent.click(screen.getByRole('button', { name: 'clear-hotkey' }));

    await waitFor(() => {
      expect(formApi.setFieldValue).toHaveBeenNthCalledWith(1, 'togglePanel', '');
      expect(formApi.setFieldValue).toHaveBeenNthCalledWith(2, 'togglePanel', 'Meta+Shift+P');
      expect(mockMessageError).toHaveBeenCalledWith('settingHotkey.saveFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to clear hotkey binding:', error);

    consoleErrorSpy.mockRestore();
  });
});
