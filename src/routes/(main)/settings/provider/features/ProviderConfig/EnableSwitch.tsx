import { App } from 'antd';
import { Skeleton } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { type FC } from 'react';
import { useTranslation } from 'react-i18next';

import InstantSwitch from '@/components/InstantSwitch';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';

const styles = createStaticStyles(({ css }) => ({
  switchLoading: css`
    width: 44px !important;
    min-width: 44px !important;
    height: 22px !important;
    border-radius: 12px !important;
  `,
}));

interface SwitchProps {
  Component?: FC<{ id: string }>;
  id: string;
}

const Switch = ({ id, Component }: SwitchProps) => {
  const { message } = App.useApp();
  const { t } = useTranslation('modelProvider');
  const [toggleProviderEnabled, enabled, isLoading] = useAiInfraStore((s) => [
    s.toggleProviderEnabled,
    aiProviderSelectors.isProviderEnabled(id)(s),
    aiProviderSelectors.isAiProviderConfigLoading(id)(s),
  ]);

  if (isLoading) return <Skeleton.Button active className={styles.switchLoading} />;

  // slot for cloud
  if (Component) return <Component id={id} />;

  return (
    <InstantSwitch
      enabled={enabled}
      onChange={async (enabled) => {
        try {
          await toggleProviderEnabled(id as any, enabled);
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
