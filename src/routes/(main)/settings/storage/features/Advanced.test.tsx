/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdvancedActions from './Advanced';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockSetFieldsValue = vi.hoisted(() => vi.fn());
const sessionStoreState = vi.hoisted(() => ({
  clearSessionGroups: vi.fn(),
  clearSessions: vi.fn(),
}));
const chatStoreState = vi.hoisted(() => ({
  clearAllMessages: vi.fn(),
  removeAllTopics: vi.fn(),
}));
const fileStoreState = vi.hoisted(() => ({
  removeAllFiles: vi.fn(),
}));
const toolStoreState = vi.hoisted(() => ({
  removeAllPlugins: vi.fn(),
}));
const userStoreState = vi.hoisted(() => ({
  resetSettings: vi.fn(),
  setSettings: vi.fn(),
  settings: {},
}));

vi.mock('@lobechat/business-const', () => ({
  BRANDING_NAME: 'LobeHub',
}));

vi.mock('@lobechat/config', () => ({
  DEFAULT_SETTINGS: {},
}));

vi.mock('@lobehub/ui', () => {
  const Form = ({ items }: any) => (
    <div>
      {items.flatMap((group: any) => group.children).map((item: any, index: number) => (
        <div key={index}>{item.children}</div>
      ))}
    </div>
  );

  Form.useForm = () => [{ setFieldsValue: mockSetFieldsValue }];

  return {
    Button: ({ children, onClick }: any) => (
      <button type="button" onClick={onClick}>
        {children}
      </button>
    ),
    Form,
    Icon: () => null,
  };
});

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
        success: mockMessageSuccess,
      },
      modal: {
        confirm: mockModalConfirm,
      },
    }),
  },
  Switch: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/business/client/features/AccountDeletion', () => ({
  default: () => null,
}));

vi.mock('@/features/DataImporter', () => ({
  default: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/services/config', () => ({
  configService: {
    exportAll: vi.fn(),
  },
}));

vi.mock('@/store/chat', () => ({
  useChatStore: (selector: any) => selector(chatStoreState),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) => selector(fileStoreState),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) => selector({ enableBusinessFeatures: false }),
}));

vi.mock('@/store/serverConfig/selectors', () => ({
  serverConfigSelectors: {
    enableBusinessFeatures: (state: any) => state.enableBusinessFeatures,
  },
}));

vi.mock('@/store/session', () => ({
  useSessionStore: (selector: any) => selector(sessionStoreState),
}));

vi.mock('@/store/tool/store', () => ({
  useToolStore: (selector: any) => selector(toolStoreState),
}));

vi.mock('@/store/user', () => ({
  useUserStore: (selector: any) => selector(userStoreState),
}));

vi.mock('@/store/user/selectors', () => ({
  settingsSelectors: {
    currentSettings: (state: typeof userStoreState) => state.settings,
  },
}));

describe('Advanced storage actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when clearing application data fails', async () => {
    const error = new Error('clear failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    sessionStoreState.clearSessions.mockRejectedValue(error);

    render(<AdvancedActions />);

    fireEvent.click(screen.getByRole('button', { name: 'danger.clear.action' }));

    const confirmConfig = mockModalConfirm.mock.calls[0][0];
    await act(async () => {
      await confirmConfig.onOk();
    });

    expect(mockMessageError).toHaveBeenCalledWith('danger.clear.error');
    expect(toolStoreState.removeAllPlugins).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to clear application data:', error);

    consoleErrorSpy.mockRestore();
  });
});
