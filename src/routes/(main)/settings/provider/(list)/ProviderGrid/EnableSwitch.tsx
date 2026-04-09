import { App } from 'antd';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';

import InstantSwitch from '@/components/InstantSwitch';
import { useAiInfraStore } from '@/store/aiInfra';

interface SwitchProps {
  Component?: FC<{ enabled: boolean; id: string }>;
  enabled: boolean;
  id: string;
}

const Switch = ({ id, Component, enabled }: SwitchProps) => {
  const { message } = App.useApp();
  const { t } = useTranslation('modelProvider');
  const [toggleProviderEnabled] = useAiInfraStore((s) => [s.toggleProviderEnabled]);

  // slot for cloud
  if (Component) return <Component enabled={enabled} id={id} />;

  return (
    <InstantSwitch
      enabled={enabled}
      size={'small'}
      onChange={async (checked) => {
        try {
          await toggleProviderEnabled(id, checked);
        } catch (error) {
          console.error('Failed to update provider enabled state:', error);
          message.error(t('updateAiProvider.toggleError'));
          throw error;
        }
      }}
    />
  );
};

export default Switch;
