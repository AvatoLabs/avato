/**
 * @vitest-environment happy-dom
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentCronJobs } from './useAgentCronJobs';

const mockMutate = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());
const mockCreate = vi.hoisted(() => vi.fn());
const mockUpdate = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());
const mockGetStats = vi.hoisted(() => vi.fn());
const mockResetExecutions = vi.hoisted(() => vi.fn());

vi.mock('antd', () => ({
  message: {
    error: mockMessageError,
    success: mockMessageSuccess,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('swr', () => ({
  default: () => ({
    data: { data: [] },
    error: undefined,
    isLoading: false,
    mutate: mockMutate,
  }),
}));

vi.mock('@/services/agentCronJob', () => ({
  agentCronJobService: {
    create: mockCreate,
    delete: mockDelete,
    getByAgentId: vi.fn(),
    getStats: mockGetStats,
    resetExecutions: mockResetExecutions,
    update: mockUpdate,
  },
}));

describe('useAgentCronJobs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error when update returns success false', async () => {
    mockUpdate.mockResolvedValue({ success: false });

    const { result } = renderHook(() => useAgentCronJobs('agent-1'));

    await act(async () => {
      await result.current.updateCronJob('job-1', { enabled: true });
    });

    expect(mockMessageError).toHaveBeenCalledWith('agentCronJobs.updateFailed');
  });

  it('shows a localized success message when reset executions succeeds', async () => {
    mockResetExecutions.mockResolvedValue({ data: { id: 'job-1' }, success: true });

    const { result } = renderHook(() => useAgentCronJobs('agent-1'));

    await act(async () => {
      await result.current.resetExecutions('job-1', 3);
    });

    expect(mockMessageSuccess).toHaveBeenCalledWith('agentCronJobs.resetExecutionsSuccess');
    expect(mockMutate).toHaveBeenCalled();
  });
});
