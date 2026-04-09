/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Body from './Body';

vi.mock('@lobehub/ui', () => ({
  Alert: ({ children, description, message, title }: any) => (
    <div>
      {title}
      {message}
      {description}
      {children}
    </div>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Form: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
  Tag: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  Form: {
    useWatch: () => 'app_1',
  },
  Switch: () => <input readOnly type="checkbox" />,
}));

vi.mock('antd-style', () => ({
  createStaticStyles: () => ({
    actionBar: 'actionBar',
    bottom: 'bottom',
    form: 'form',
    webhookBox: 'webhookBox',
  }),
}));

vi.mock('react-i18next', () => ({
  Trans: ({ children }: any) => <>{children}</>,
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useAppOrigin', () => ({
  useAppOrigin: () => 'https://app.local',
}));

vi.mock('./platforms/discord', () => ({
  getDiscordFormItems: () => [],
}));

vi.mock('./platforms/feishu', () => ({
  getFeishuFormItems: () => [],
}));

vi.mock('./platforms/lark', () => ({
  getLarkFormItems: () => [],
}));

vi.mock('./platforms/telegram', () => ({
  getTelegramFormItems: () => [],
}));

describe('Agent channel detail body', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('calls the failure callback when copying the webhook URL fails', async () => {
    const copyError = new Error('clipboard blocked');
    const onCopied = vi.fn();
    const onCopyFailed = vi.fn();

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(copyError),
      },
    });

    render(
      <Body
        currentConfig={{ enabled: true }}
        form={{} as any}
        hasConfig
        onCopied={onCopied}
        onCopyFailed={onCopyFailed}
        onDelete={vi.fn()}
        onSave={vi.fn()}
        onTestConnection={vi.fn()}
        onToggleEnable={vi.fn()}
        provider={{
          color: '#1677ff',
          fieldTags: { webhook: 'Webhook' },
          icon: 'icon',
          id: 'telegram',
          webhookMode: 'manual',
        } as any}
        saving={false}
        testing={false}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'channel.copy' }));

    await waitFor(() => {
      expect(onCopyFailed).toHaveBeenCalledTimes(1);
    });

    expect(onCopied).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to copy webhook URL:', copyError);
  });
});
