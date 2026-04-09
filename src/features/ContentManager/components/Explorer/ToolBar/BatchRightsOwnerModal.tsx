'use client';

import { Button, Flexbox } from '@lobehub/ui';
import { createModal, useModalContext } from '@lobehub/ui/base-ui';
import { Input } from 'antd';
import { t as translate } from 'i18next';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface BatchRightsOwnerModalContentProps {
  count: number;
  onSubmit: (rightsOwner: string | null) => Promise<void>;
}

const BatchRightsOwnerModalContent = memo<BatchRightsOwnerModalContentProps>(({ count, onSubmit }) => {
  const { t } = useTranslation(['common', 'components', 'file']);
  const { close } = useModalContext();
  const [value, setValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const translateText = (key: string, options?: Record<string, any>) =>
    t(key as any, options as any) as string;

  const normalizedValue = value.trim();

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      await onSubmit(normalizedValue || null);
      close();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Flexbox gap={12} paddingInline={8} style={{ paddingBottom: 8 }}>
      <span>{translateText('FileManager.actions.setAssetRightsOwnerDescription', { count })}</span>
      <Input
        allowClear
        aria-label={t('detail.asset.rightsOwner.label', { ns: 'file' })}
        autoFocus
        placeholder={t('detail.asset.rightsOwner.placeholder', { ns: 'file' })}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onPressEnter={() => void handleSubmit()}
      />
      <span style={{ color: 'rgba(0, 0, 0, 0.45)', fontSize: 12 }}>
        {translateText('FileManager.actions.setAssetRightsOwnerHint')}
      </span>
      <Flexbox horizontal justify={'flex-end'} gap={8}>
        <Button size={'small'} onClick={close}>
          {t('cancel', { ns: 'common' })}
        </Button>
        <Button loading={isSubmitting} size={'small'} type={'primary'} onClick={() => void handleSubmit()}>
          {normalizedValue
            ? t('save', { ns: 'common' })
            : translateText('FileManager.actions.clearAssetRightsOwner')}
        </Button>
      </Flexbox>
    </Flexbox>
  );
});

BatchRightsOwnerModalContent.displayName = 'BatchRightsOwnerModalContent';

interface OpenBatchRightsOwnerModalParams {
  count: number;
  onSubmit: (rightsOwner: string | null) => Promise<void>;
}

export const createBatchRightsOwnerModal = ({ count, onSubmit }: OpenBatchRightsOwnerModalParams) =>
  createModal({
    children: <BatchRightsOwnerModalContent count={count} onSubmit={onSubmit} />,
    footer: null,
    title: translate('FileManager.actions.setAssetRightsOwnerTitle', { count, ns: 'components' }),
    width: 420,
  });
