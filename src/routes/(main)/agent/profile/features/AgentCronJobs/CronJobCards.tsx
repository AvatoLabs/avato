'use client';

import { ActionIcon, Flexbox, Icon } from '@lobehub/ui';
import { Badge, Card, Col, Popconfirm, Row, Switch, Typography } from 'antd';
import { cssVar } from 'antd-style';
import dayjs from 'dayjs';
import { Calendar, Clock, Edit, Trash2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { type AgentCronJob } from '@/database/schemas/agentCronJob';

import { useAgentCronJobs } from './hooks/useAgentCronJobs';
import { getCronJobIntervalText, getCronJobStatusInfo } from './shared';

const { Text } = Typography;

interface CronJobCardsProps {
  cronJobs: AgentCronJob[];
  loading?: boolean;
  onDelete: (jobId: string) => void;
  onEdit: (jobId: string) => void;
}

const CronJobCards = memo<CronJobCardsProps>(({ cronJobs, loading, onDelete, onEdit }) => {
  const { t } = useTranslation('setting');
  const { updateCronJob } = useAgentCronJobs();

  const handleToggleEnabled = async (job: AgentCronJob) => {
    try {
      await updateCronJob(job.id, { enabled: !job.enabled });
    } catch {}
  };

  return (
    <Row gutter={[12, 12]}>
      {cronJobs.map((job) => {
        const statusInfo = getCronJobStatusInfo(job);
        const intervalText = getCronJobIntervalText(job.cronPattern);

        return (
          <Col key={job.id} lg={8} md={12} xs={24}>
            <Card
              loading={loading}
              size="small"
              style={{ height: '100%' }}
              extra={
                <Flexbox horizontal align="center" gap={4}>
                  <ActionIcon
                    icon={Edit}
                    size="small"
                    title={t('agentCronJobs.editJob')}
                    onClick={() => onEdit(job.id)}
                  />
                  <Popconfirm
                    title={t('agentCronJobs.confirmDelete')}
                    onConfirm={() => onDelete(job.id)}
                  >
                    <ActionIcon icon={Trash2} size="small" title={t('agentCronJobs.deleteJob')} />
                  </Popconfirm>
                </Flexbox>
              }
              styles={{
                actions: { marginTop: 0 },
                body: { paddingBottom: 12, paddingTop: 8 },
                header: { borderBottom: 'none', marginTop: '8px', minHeight: 0, paddingBottom: 0 },
              }}
              title={
                <Flexbox horizontal align="flex-start" justify="space-between">
                  <Flexbox gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      ellipsis
                      style={{
                        fontSize: '13px',
                        fontWeight: 500,
                        minWidth: 0,
                      }}
                    >
                      {job.name || t('agentCronJobs.unnamedTask')}
                    </Text>
                    <Badge
                      status={statusInfo.status}
                      text={
                        <Text style={{ color: cssVar.colorTextSecondary, fontSize: '11px' }}>
                          {t(statusInfo.text as any)}
                        </Text>
                      }
                    />
                  </Flexbox>
                  <Switch
                    checked={job.enabled || false}
                    size="small"
                    onChange={() => handleToggleEnabled(job)}
                  />
                </Flexbox>
              }
            >
              <Flexbox gap={8}>
                <Text
                  ellipsis={{ tooltip: job.content }}
                  style={{
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    color: cssVar.colorTextSecondary,
                    display: '-webkit-box',
                    fontSize: '12px',
                    overflow: 'hidden',
                  }}
                >
                  {job.content}
                </Text>

                <Flexbox gap={8}>
                  <Flexbox horizontal align="center" gap={6}>
                    <Icon icon={Clock} size={12} />
                    <Text style={{ color: cssVar.colorTextTertiary, fontSize: '11px' }}>
                      {t(intervalText as any)}
                    </Text>
                  </Flexbox>

                  {job.remainingExecutions !== null && (
                    <Flexbox horizontal align="center" gap={6}>
                      <Text style={{ color: cssVar.colorTextTertiary, fontSize: '11px' }}>
                        {t('agentCronJobs.remainingExecutions', { count: job.remainingExecutions })}
                      </Text>
                    </Flexbox>
                  )}

                  {job.lastExecutedAt && (
                    <Flexbox horizontal align="center" gap={6}>
                      <Icon icon={Calendar} size={12} />
                      <Text style={{ color: cssVar.colorTextTertiary, fontSize: '11px' }}>
                        {dayjs(job.lastExecutedAt).format('MM/DD HH:mm')}
                      </Text>
                    </Flexbox>
                  )}
                </Flexbox>
              </Flexbox>
            </Card>
          </Col>
        );
      })}
    </Row>
  );
});

export default CronJobCards;
