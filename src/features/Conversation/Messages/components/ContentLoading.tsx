import { Flexbox } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import BubblesLoading from '@/components/BubblesLoading';
import NeuralNetworkLoading from '@/components/NeuralNetworkLoading';
import { useChatStore } from '@/store/chat';
import { operationSelectors } from '@/store/chat/selectors';
import { type OperationType } from '@/store/chat/slices/operation/types';
import { shinyTextStyles } from '@/styles/loading';

const ELAPSED_TIME_THRESHOLD = 2100; // Show elapsed time after 2 seconds

const NO_NEED_SHOW_DOT_OP_TYPES = new Set<OperationType>(['reasoning']);

const styles = createStaticStyles(({ css, cssVar }) => ({
  chip: css`
    display: inline-flex;
    gap: 8px;
    align-items: center;

    min-height: 30px;
    padding-block: 5px;
    padding-inline: 12px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 76%, transparent);
    border-radius: 999px;

    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorBgElevated} 96%, ${cssVar.colorFillQuaternary}) 0%,
      color-mix(in srgb, ${cssVar.colorFillQuaternary} 82%, ${cssVar.colorBgContainer}) 100%
    );
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, ${cssVar.colorTextLightSolid} 12%, transparent),
      0 16px 28px -24px color-mix(in srgb, ${cssVar.colorText} 26%, transparent);
  `,
  label: css`
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
    color: color-mix(in srgb, ${cssVar.colorTextSecondary} 78%, ${cssVar.colorText} 22%);
    letter-spacing: 0.01em;
  `,
  meta: css`
    display: inline-flex;
    align-items: center;

    min-height: 24px;
    padding-inline: 8px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 70%, transparent);
    border-radius: 999px;

    font-size: 11px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: color-mix(in srgb, ${cssVar.colorTextDescription} 72%, ${cssVar.colorText} 28%);

    background: color-mix(in srgb, ${cssVar.colorBgElevated} 88%, ${cssVar.colorFillQuaternary});
  `,
}));

interface ContentLoadingProps {
  id: string;
}

const ContentLoading = memo<ContentLoadingProps>(({ id }) => {
  const { t } = useTranslation('chat');
  const runningOp = useChatStore(operationSelectors.getDeepestRunningOperationByMessage(id));

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(runningOp?.metadata?.startTime);

  const operationType = runningOp?.type as OperationType | undefined;

  // Track elapsed time, reset when operation type changes
  useEffect(() => {
    if (!startTime) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedSeconds(elapsed);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [startTime]);

  useEffect(() => {
    setElapsedSeconds(0);
    setStartTime(Date.now());
  }, [operationType, id]);

  // Get localized label based on operation type
  const operationLabel = operationType
    ? (t(`operation.${operationType}` as any) as string)
    : undefined;

  const showElapsedTime = elapsedSeconds >= ELAPSED_TIME_THRESHOLD / 1000;

  if (operationType && NO_NEED_SHOW_DOT_OP_TYPES.has(operationType)) return null;

  if (operationType === 'contextCompression') {
    return (
      <Flexbox horizontal align={'center'} gap={8}>
        <Flexbox horizontal align={'center'} className={styles.chip} gap={8}>
          <NeuralNetworkLoading size={16} />
          <span className={shinyTextStyles.shinyText}>{t('operation.contextCompression')}</span>
        </Flexbox>
        {showElapsedTime && <span className={styles.meta}>{elapsedSeconds}s</span>}
      </Flexbox>
    );
  }

  return (
    <Flexbox horizontal align={'center'} gap={8}>
      <Flexbox horizontal align={'center'} className={styles.chip} gap={8}>
        <span className={styles.label}>
          <BubblesLoading size={5} />
        </span>
        {operationLabel && <span className={styles.label}>{operationLabel}</span>}
      </Flexbox>
      {showElapsedTime && <span className={styles.meta}>{elapsedSeconds}s</span>}
    </Flexbox>
  );
});

export default ContentLoading;
