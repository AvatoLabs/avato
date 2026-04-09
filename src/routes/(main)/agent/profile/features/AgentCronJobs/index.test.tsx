/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AgentCronJobs from './index';

const mockDeleteCronJob = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd', () => ({
  Typography: {
    Title: ({ children }: any) => <div>{children}</div>,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useQueryRoute', () => ({
  useQueryRoute: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/store/agent/store', () => ({
  useAgentStore: (selector: any) =>
    selector({
      activeAgentId: 'agent-1',
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: () => true,
  serverConfigSelectors: {
    enableBusinessFeatures: 'enableBusinessFeatures',
  },
}));

vi.mock('./hooks/useAgentCronJobs', () => ({
  useAgentCronJobs: () => ({
    cronJobs: [{ id: 'job-1' }],
    deleteCronJob: mockDeleteCronJob,
    loading: false,
  }),
}));

vi.mock('./CronJobCards', () => ({
  __esModule: true,
  default: ({ onDelete }: any) => (
    <button type="button" onClick={() => onDelete('job-1')}>
      delete job
    </button>
  ),
}));

describe('AgentCronJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('swallows delete failures without leaking unhandled rejections', async () => {
    mockDeleteCronJob.mockRejectedValue(new Error('delete failed'));

    render(<AgentCronJobs />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'delete job' }));
    });

    await waitFor(() => {
      expect(mockDeleteCronJob).toHaveBeenCalledWith('job-1');
    });
  });
});
