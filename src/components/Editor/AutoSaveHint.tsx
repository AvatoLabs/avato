'use client';

import { Icon, Tag } from '@lobehub/ui';
import dayjs from 'dayjs';
import { CloudIcon, Loader2Icon } from 'lucide-react';
import { type CSSProperties } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface AutoSaveHintProps {
  lastUpdatedTime?: string | Date | null;
  saveStatus: 'idle' | 'saving' | 'saved';
  style?: CSSProperties;
}

/**
 * AutoSaveHint - Unified save status indicator for editors
 *
 * Displays real-time save status for document/config changes
 */
const AutoSaveHint = memo<AutoSaveHintProps>(({ style, saveStatus, lastUpdatedTime }) => {
  const { t } = useTranslation('editor');

  const isSaving = saveStatus === 'saving';
  const hintStyle: CSSProperties = {
    display: 'inline-flex',
    justifyContent: 'center',
    minWidth: 160,
    ...style,
  };
  const updatedAtTitle = lastUpdatedTime
    ? dayjs(lastUpdatedTime).format('YYYY-MM-DD HH:mm:ss')
    : undefined;

  if (isSaving)
    return (
      <Tag icon={<Icon spin icon={Loader2Icon} />} style={hintStyle}>
        {t('autoSave.saving')}
      </Tag>
    );

  if (saveStatus === 'saved' && lastUpdatedTime)
    return (
      <Tag icon={<Icon icon={CloudIcon} />} style={hintStyle} title={updatedAtTitle}>
        {t('autoSave.saved')}
      </Tag>
    );

  return (
    <Tag icon={<Icon icon={CloudIcon} />} style={hintStyle} title={updatedAtTitle}>
      {t('autoSave.latest')}
    </Tag>
  );
});

export default AutoSaveHint;
