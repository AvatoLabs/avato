/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CronJobCards from './CronJobCards';

const mockUpdateCronJob = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  ActionIcon: ({ onClick, title }: any) => (
    <button aria-label={title} type="button" onClick={onClick}>
      {title}
    </button>
  ),
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Icon: () => null,
}));

vi.mock('antd', () => ({
  Badge: ({ text }: any) => <span>{text}</span>,
  Card: ({ extra, title, children }: any) => (
    <div>
      {title}
      {extra}
      {children}
    </div>
  ),
  Col: ({ children }: any) => <div>{children}</div>,
  Popconfirm: ({ children }: any) => <div>{children}</div>,
  Row: ({ children }: any) => <div>{children}</div>,
  Switch: ({ checked, onChange }: any) => (
    <button aria-label="toggle" data-checked={checked} type="button" onClick={onChange} />
  ),
  Typography: {
    Text: ({ children }: any) => <span>{children}</span>,
  },
}));

vi.mock('antd-style', () => ({
  cssVar: {
    colorTextSecondary: '#666',
    colorTextTertiary: '#999',
  },
}));

vi.mock('dayjs', () => ({
  default: () => ({
    format: () => '04/08 12:00',
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('./hooks/useAgentCronJobs', () => ({
  useAgentCronJobs: () => ({
    updateCronJob: mockUpdateCronJob,
  }),
}));

vi.mock('./shared', () => ({
  getCronJobIntervalText: () => 'agentCronJobs.interval.daily',
  getCronJobStatusInfo: () => ({
    status: 'success',
    text: 'agentCronJobs.status.enabled',
  }),
}));

describe('CronJobCards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('swallows toggle failures without leaking unhandled rejections', async () => {
    mockUpdateCronJob.mockRejectedValue(new Error('toggle failed'));

    render(
      <CronJobCards
        cronJobs={[
          {
            content: 'Run task',
            cronPattern: '0 0 * * *',
            enabled: true,
            id: 'job-1',
            lastExecutedAt: null,
            name: 'Job 1',
            remainingExecutions: null,
          } as any,
        ]}
        onDelete={vi.fn()}
        onEdit={vi.fn()}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    });

    await waitFor(() => {
      expect(mockUpdateCronJob).toHaveBeenCalledWith('job-1', { enabled: false });
    });
  });
});
