/**
 * @vitest-environment happy-dom
 */
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Conversation from './Conversation';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockSetSettings = vi.hoisted(() => vi.fn());
const formApi = vi.hoisted(() => ({
  setFieldValue: vi.fn(),
  setFieldsValue: vi.fn(),
}));
const formBridge = vi.hoisted(() => ({
  onValuesChange: undefined as undefined | ((values: any) => Promise<void>),
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
  const Form = ({ items, onValuesChange }: any) => {
    formBridge.onValuesChange = onValuesChange;

    return (
      <div>
        {items?.flatMap((group: any, groupIndex: number) =>
          group.children?.map((item: any, itemIndex: number) => (
            <div key={`${groupIndex}-${itemIndex}`}>{item.children}</div>
          )),
        )}
      </div>
    );
  };

  Form.useForm = () => [formApi];

  return {
    Form,
    HotkeyInput: () => <div>hotkey-input</div>,
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
      group: 'conversation',
      id: 'sendMessage',
      keys: 'Enter',
      nonEditable: false,
    },
  ],
}));

vi.mock('@/locales/default/hotkey', () => ({
  default: {
    'sendMessage.desc': 'Send a message',
  },
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) =>
    selector({
      hotkey: {
        sendMessage: 'Enter',
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

describe('Conversation hotkeys', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and restores the saved hotkeys when updating fails', async () => {
    const error = new Error('save failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSetSettings.mockRejectedValue(error);

    render(<Conversation />);

    await act(async () => {
      await formBridge.onValuesChange?.({ sendMessage: 'Ctrl+Enter' });
    });

    await waitFor(() => {
      expect(formApi.setFieldsValue).toHaveBeenCalledWith({
        sendMessage: 'Enter',
      });
      expect(mockMessageError).toHaveBeenCalledWith('settingHotkey.saveFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save hotkey settings:', error);

    consoleErrorSpy.mockRestore();
  });
});
