import { type AgentCronJob } from '@/database/schemas/agentCronJob';

export const getCronJobIntervalText = (cronPattern: string) => {
  const intervalMap: Record<string, string> = {
    '*/30 * * * *': 'agentCronJobs.interval.30min',
    '0 * * * *': 'agentCronJobs.interval.1hour',
    '0 */12 * * *': 'agentCronJobs.interval.12hours',
    '0 */2 * * *': 'agentCronJobs.interval.2hours',
    '0 */6 * * *': 'agentCronJobs.interval.6hours',
    '0 0 * * *': 'agentCronJobs.interval.daily',
    '0 0 * * 0': 'agentCronJobs.interval.weekly',
  };

  return intervalMap[cronPattern] || cronPattern;
};

export const getCronJobStatusInfo = (job: AgentCronJob) => {
  if (!job.enabled) {
    return { status: 'default' as const, text: 'agentCronJobs.status.disabled' };
  }

  if (job.remainingExecutions === 0) {
    return { status: 'error' as const, text: 'agentCronJobs.status.depleted' };
  }

  return { status: 'success' as const, text: 'agentCronJobs.status.enabled' };
};
