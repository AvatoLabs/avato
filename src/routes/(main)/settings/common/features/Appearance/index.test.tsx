/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Appearance from './index';

const mockMessageError = vi.hoisted(() => vi.fn());
const mockSetSettings = vi.hoisted(() => vi.fn());
const formApi = vi.hoisted(() => ({
  setFieldsValue: vi.fn(),
}));
const formBridge = vi.hoisted(() => ({
  onValuesChange: undefined as undefined | ((values: any) => Promise<void>),
}));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();

  return {
    ...actual,
    App: {
      useApp: () => ({
        message: {
          error: mockMessageError,
        },
      }),
    },
    Segmented: () => null,
  };
});

vi.mock('@lobehub/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@lobehub/ui')>();
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
    ...actual,
    Form,
    Icon: () => null,
    Skeleton: () => null,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('./Preview', () => ({
  default: () => null,
}));

vi.mock('./ThemePresetSelect', () => ({
  default: ({ onChange, value }: any) => (
    <button data-value={value} type="button" onClick={() => void onChange('forest')}>
      select-preset
    </button>
  ),
}));

vi.mock('./ThemeSwatches', () => ({
  ThemeSwatchesNeutral: () => null,
  ThemeSwatchesPrimary: () => null,
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) =>
    selector({
      general: {
        animationMode: 'agile',
        contextMenuMode: 'default',
      },
      isUserStateInit: true,
      setSettings: mockSetSettings,
    }),
}));

vi.mock('@/store/user/slices/settings/selectors', () => ({
  settingsSelectors: {
    currentSettings: (state: any) => state,
  },
}));

describe('Appearance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when updating a theme preset fails', async () => {
    const error = new Error('preset failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSetSettings.mockRejectedValue(error);

    render(<Appearance />);

    expect(screen.getByRole('button', { name: 'select-preset' })).toHaveAttribute(
      'data-value',
      'obsidian',
    );

    fireEvent.click(screen.getByRole('button', { name: 'select-preset' }));

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('settingAppearance.saveFailed');
      expect(screen.getByRole('button', { name: 'select-preset' })).toHaveAttribute(
        'data-value',
        'obsidian',
      );
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save appearance settings:', error);

    consoleErrorSpy.mockRestore();
  });

  it('shows an error and restores the saved form values when appearance form save fails', async () => {
    const error = new Error('form failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockSetSettings.mockRejectedValue(error);

    render(<Appearance />);

    await act(async () => {
      await formBridge.onValuesChange?.({ animationMode: 'disabled' });
    });

    await waitFor(() => {
      expect(formApi.setFieldsValue).toHaveBeenCalledWith({
        animationMode: 'agile',
        contextMenuMode: 'default',
      });
      expect(mockMessageError).toHaveBeenCalledWith('settingAppearance.saveFailed');
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to save appearance settings:', error);

    consoleErrorSpy.mockRestore();
  });
});
