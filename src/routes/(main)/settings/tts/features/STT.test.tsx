/**
 * @vitest-environment happy-dom
 */
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import STT from './STT';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockSetSettings = vi.hoisted(() => vi.fn());
const formApi = vi.hoisted(() => ({
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
  Switch: () => null,
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
    Icon: () => null,
    Select: () => null,
    Skeleton: () => null,
  };
});

vi.mock('./const', () => ({
  sttOptions: [],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) =>
    selector({
      isUserStateInit: true,
      setSettings: mockSetSettings,
      tts: {
        sttAutoStop: true,
        sttServer: 'browser',
      },
    }),
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentSettings: (state: any) => state,
  },
}));

describe('STT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and restores the saved tts settings when saving fails', async () => {
    const error = new Error('save failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSetSettings.mockRejectedValue(error);

    render(<STT />);

    await act(async () => {
      await formBridge.onValuesChange?.({ sttServer: 'openai' });
    });

    await waitFor(() => {
      expect(formApi.setFieldsValue).toHaveBeenCalledWith({
        sttAutoStop: true,
        sttServer: 'browser',
      });
      expect(mockMessageError).toHaveBeenCalledWith('settingTTS.saveFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save speech settings:', error);

    consoleErrorSpy.mockRestore();
  });
});
