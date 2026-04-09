/**
 * @vitest-environment happy-dom
 */
import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import OpenAI from './OpenAI';

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
  opeanaiSTTOptions: [],
  opeanaiTTSOptions: [],
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
        openAI: {
          sttModel: 'whisper-1',
          ttsModel: 'tts-1',
        },
      },
    }),
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentSettings: (state: any) => state,
  },
}));

describe('OpenAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error and restores the saved openai speech settings when saving fails', async () => {
    const error = new Error('save failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSetSettings.mockRejectedValue(error);

    render(<OpenAI />);

    await act(async () => {
      await formBridge.onValuesChange?.({
        openAI: {
          sttModel: 'gpt-4o-mini-transcribe',
        },
      });
    });

    await waitFor(() => {
      expect(formApi.setFieldsValue).toHaveBeenCalledWith({
        openAI: {
          sttModel: 'whisper-1',
          ttsModel: 'tts-1',
        },
      });
      expect(mockMessageError).toHaveBeenCalledWith('settingTTS.saveFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save speech settings:', error);

    consoleErrorSpy.mockRestore();
  });
});
