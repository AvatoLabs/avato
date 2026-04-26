import { message } from 'antd';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import useSWR from 'swr';

import {
  type CreateAgentCronJobData,
  type UpdateAgentCronJobData,
} from '@/database/schemas/agentCronJob';
import { agentCronJobService } from '@/services/agentCronJob';

export const useAgentCronJobs = (agentId?: string, enabled: boolean = true) => {
  const { t } = useTranslation('setting');
  const notifyFailure = useCallback(
    (key: string) => {
      message.error(t(key as any));
    },
    [t],
  );

  // Fetch cron jobs for the agent
  const {
    data: cronJobs,
    error,
    isLoading: loading,
    mutate,
  } = useSWR(
    enabled && agentId ? `/api/agent-cron-jobs/${agentId}` : null,
    enabled && agentId ? () => agentCronJobService.getByAgentId(agentId) : null,
    {
      onError: (error) => {
        console.error('Failed to fetch cron jobs:', error);
        notifyFailure('agentCronJobs.loadFailed');
      },
    },
  );

  // Create a new cron job
  const createCronJob = useCallback(
    async (data: Omit<CreateAgentCronJobData, 'userId'>) => {
      if (!agentId) return;

      try {
        const result = await agentCronJobService.create({
          ...data,
          agentId,
        });

        if (result.success) {
          message.success(t('agentCronJobs.createSuccess'));
          await mutate();
          return result.data;
        }

        notifyFailure('agentCronJobs.createFailed');
      } catch (error) {
        console.error('Failed to create cron job:', error);
        notifyFailure('agentCronJobs.createFailed');
        throw error;
      }
    },
    [agentId, mutate, notifyFailure, t],
  );

  // Update a cron job
  const updateCronJob = useCallback(
    async (id: string, data: UpdateAgentCronJobData) => {
      try {
        const result = await agentCronJobService.update(id, data);

        if (result.success) {
          message.success(t('agentCronJobs.updateSuccess'));
          await mutate();
          return result.data;
        }

        notifyFailure('agentCronJobs.updateFailed');
      } catch (error) {
        console.error('Failed to update cron job:', error);
        notifyFailure('agentCronJobs.updateFailed');
        throw error;
      }
    },
    [mutate, notifyFailure, t],
  );

  // Delete a cron job
  const deleteCronJob = useCallback(
    async (id: string) => {
      try {
        const result = await agentCronJobService.delete(id);

        if (result.success) {
          message.success(t('agentCronJobs.deleteSuccess'));
          await mutate();
          return;
        }

        notifyFailure('agentCronJobs.deleteFailed');
      } catch (error) {
        console.error('Failed to delete cron job:', error);
        notifyFailure('agentCronJobs.deleteFailed');
        throw error;
      }
    },
    [mutate, notifyFailure, t],
  );

  // Get execution statistics
  const getStats = useCallback(async () => {
    try {
      return await agentCronJobService.getStats();
    } catch (error) {
      console.error('Failed to get cron job stats:', error);
      notifyFailure('agentCronJobs.loadStatsFailed');
      throw error;
    }
  }, [notifyFailure]);

  // Reset execution counts
  const resetExecutions = useCallback(
    async (id: string, newMaxExecutions?: number) => {
      try {
        const result = await agentCronJobService.resetExecutions(id, newMaxExecutions);

        if (result.success) {
          message.success(t('agentCronJobs.resetExecutionsSuccess'));
          await mutate();
          return result.data;
        }

        notifyFailure('agentCronJobs.resetExecutionsFailed');
      } catch (error) {
        console.error('Failed to reset executions:', error);
        notifyFailure('agentCronJobs.resetExecutionsFailed');
        throw error;
      }
    },
    [mutate, notifyFailure, t],
  );

  return {
    createCronJob,
    cronJobs: cronJobs?.data || [],
    deleteCronJob,
    error,
    getStats,
    loading,
    refetch: mutate,
    resetExecutions,
    updateCronJob,
  };
};
