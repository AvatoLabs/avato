'use client';

import { ActionIcon, Button, Icon, Tooltip } from '@lobehub/ui';
import { App } from 'antd';
import { createStyles, useTheme } from 'antd-style';
import { CalendarClockIcon } from 'lucide-react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useMemoryAnalysisAsyncTask } from '@/routes/(main)/memory/features/MemoryAnalysis/useTask';
import {
  memoryExtractionService,
  type MemoryExtractionTask,
} from '@/services/userMemory/extraction';

import DateRangeModal from './DateRangeModal';

const useStyles = createStyles(({ css, token }) => ({
  solidPrimaryForeground: css`
    &,
    &:hover,
    &:active,
    &:focus {
      color: ${token.colorTextLightSolid} !important;
    }

    &.ant-btn-primary:not(.ant-btn-disabled),
    &.ant-btn-color-primary:not(.ant-btn-disabled) {
      color: ${token.colorTextLightSolid} !important;
    }

    & .anticon,
    & svg,
    &.ant-btn-primary:not(.ant-btn-disabled) .anticon,
    &.ant-btn-primary:not(.ant-btn-disabled) svg,
    &.ant-btn-color-primary:not(.ant-btn-disabled) .anticon,
    &.ant-btn-color-primary:not(.ant-btn-disabled) svg {
      color: ${token.colorTextLightSolid} !important;
    }
  `,
}));

interface Props {
  footerNote: string;
  iconOnly?: boolean;
  onRangeChange: (range: [Date | null, Date | null]) => void;
  range: [Date | null, Date | null];
}

const AnalysisTrigger = memo<Props>(({ footerNote, range, onRangeChange, iconOnly }) => {
  const { styles } = useStyles();
  const theme = useTheme();
  const { t } = useTranslation('memory');
  const { message } = App.useApp();
  const { isValidating, refresh } = useMemoryAnalysisAsyncTask();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resolveTaskErrorMessage = (task: MemoryExtractionTask | null | undefined) => {
    const body = task?.error?.body;

    if (typeof body === 'string') return body;
    if (body?.detail) return body.detail;

    return '';
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const [from, to] = range;
      const result = await memoryExtractionService.requestFromChatTopics({
        fromDate: from ?? undefined,
        toDate: to ?? undefined,
      });

      await refresh();
      message.success(result.deduped ? t('analysis.toast.deduped') : t('analysis.toast.started'));

      setOpen(false);
    } catch (error) {
      console.error(error);
      const task = await refresh();
      const detail =
        resolveTaskErrorMessage(task) ||
        (error instanceof Error && error.message ? error.message : '') ||
        t('analysis.toast.failed');

      message.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const loading = submitting || isValidating;

  return (
    <>
      {iconOnly ? (
        <Tooltip title={t('analysis.action.button')}>
          <ActionIcon
            className={styles.solidPrimaryForeground}
            color={theme.colorTextLightSolid}
            icon={CalendarClockIcon}
            loading={loading}
            onClick={() => setOpen(true)}
          />
        </Tooltip>
      ) : (
        <Button
          className={styles.solidPrimaryForeground}
          icon={<Icon icon={CalendarClockIcon} />}
          iconProps={{ color: theme.colorTextLightSolid }}
          loading={loading}
          size={'large'}
          style={{ maxWidth: 300 }}
          type={'primary'}
          onClick={() => setOpen(true)}
        >
          {t('analysis.action.button')}
        </Button>
      )}

      <DateRangeModal
        footerNote={footerNote}
        open={open}
        range={range}
        submitting={submitting}
        onCancel={() => setOpen(false)}
        onChange={onRangeChange}
        onSubmit={handleSubmit}
      />
    </>
  );
});

AnalysisTrigger.displayName = 'AnalysisTrigger';

export default AnalysisTrigger;
