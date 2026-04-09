'use client';

import { ActionIcon, Flexbox, Icon } from '@lobehub/ui';
import { Badge, List, Popconfirm, Switch, Typography } from 'antd';
import { cssVar } from 'antd-style';
import dayjs from 'dayjs';
import { Calendar, Clock, Edit, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { type AgentCronJob } from '@/database/schemas/agentCronJob';

import { useAgentCronJobs } from './hooks/useAgentCronJobs';
import { getCronJobIntervalText, getCronJobStatusInfo } from './shared';

const { Text, Paragraph } = Typography;

interface CronJobListProps {
  cronJobs: AgentCronJob[];
  loading?: boolean;
  onDelete: (jobId: string) => void;
  onEdit: (jobId: string) => void;
}

const CronJobList = memo<CronJobListProps>(({ cronJobs, loading, onEdit, onDelete }) => {
  const { t } = useTranslation('setting');
  const { updateCronJob } = useAgentCronJobs();

  const handleToggleEnabled = async (job: AgentCronJob) => {
    try {
      await updateCronJob(job.id, { enabled: !job.enabled });
    } catch {}
  };

  return (
    <List
      dataSource={cronJobs}
      loading={loading}
      renderItem={(job) => {
        const statusInfo = getCronJobStatusInfo(job);
        const intervalText = getCronJobIntervalText(job.cronPattern);

        return (
          <List.Item
            actions={[
              <ActionIcon
                icon={Edit}
                key="edit"
                size="small"
                title={t('agentCronJobs.editJob')}
                onClick={() => onEdit(job.id)}
              />,
              <Popconfirm
                key="delete"
                title={t('agentCronJobs.confirmDelete')}
                onConfirm={() => onDelete(job.id)}
              >
                <ActionIcon icon={Trash2} size="small" title={t('agentCronJobs.deleteJob')} />
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={
                <Switch
                  checked={job.enabled || false}
                  size="small"
                  onChange={() => handleToggleEnabled(job)}
                />
              }
              description={
                <Flexbox gap={4}>
                  <Paragraph
                    ellipsis={{ rows: 2, tooltip: job.content }}
                    style={{ fontSize: '12px', margin: 0 }}
                    type={'secondary'}
                  >
                    {job.content}
                  </Paragraph>

                  <Flexbox horizontal gap={8} style={{ marginTop: 4 }}>
                    <Flexbox horizontal align="center" gap={4}>
                      <Icon icon={Clock} size={12} />
                      <Text style={{ color: cssVar.colorTextTertiary, fontSize: '11px' }}>
                        {t(intervalText as any)}
                      </Text>
                    </Flexbox>

                    {job.remainingExecutions !== null && (
                      <Text style={{ color: cssVar.colorTextTertiary, fontSize: '11px' }}>
                        {t('agentCronJobs.remainingExecutions', { count: job.remainingExecutions })}
                      </Text>
                    )}

                    {job.lastExecutedAt && (
                      <Flexbox horizontal align="center" gap={4}>
                        <Icon icon={Calendar} size={12} />
                        <Text style={{ color: cssVar.colorTextTertiary, fontSize: '11px' }}>
                          {dayjs(job.lastExecutedAt).format('MM/DD HH:mm')}
                        </Text>
                      </Flexbox>
                    )}
                  </Flexbox>
                </Flexbox>
              }
              title={
                <Flexbox horizontal align="center" gap={8} style={{ minWidth: 0 }}>
                  <Text ellipsis strong style={{ minWidth: 0 }}>
                    {job.name}
                  </Text>
                  <Badge status={statusInfo.status} text={t(statusInfo.text as any)} />
                </Flexbox>
              }
            />
          </List.Item>
        );
      }}
    />
  );
});

export default CronJobList;
