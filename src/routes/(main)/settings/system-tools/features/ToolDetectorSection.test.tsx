/**
 * @vitest-environment happy-dom
 */
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ToolDetectorSection from './ToolDetectorSection';

const mockDetectAllTools = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Button: ({ children, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {children}
    </button>
  ),
  CopyButton: () => null,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Form: ({ footer }: any) => <div>{footer}</div>,
  Icon: () => null,
  Skeleton: () => <div>loading</div>,
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
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

vi.mock('antd-style', () => ({}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/const/layoutTokens', () => ({
  FORM_STYLE: {},
}));

vi.mock('@/services/electron/toolDetector', () => ({
  toolDetectorService: {
    detectAllTools: mockDetectAllTools,
  },
}));

describe('ToolDetectorSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when tool detection fails', async () => {
    const error = new Error('detect failed');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDetectAllTools.mockRejectedValue(error);

    render(<ToolDetectorSection />);

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('settingSystemTools.detectFailed');
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to detect tools:', error);

    consoleErrorSpy.mockRestore();
  });
});
