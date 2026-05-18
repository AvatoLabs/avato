import { Flexbox } from '@lobehub/ui';
import { Switch } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfigProps {
  config: { showFilesInSourceSet: boolean };
  onConfigChange: (config: { showFilesInSourceSet: boolean }) => void;
}

const Config = memo<ConfigProps>(({ config, onConfigChange }) => {
  const { t } = useTranslation('components');

  return (
    <Flexbox
      horizontal
      align={'center'}
      gap={8}
      onClick={() => {
        onConfigChange({ showFilesInSourceSet: !config.showFilesInSourceSet });
      }}
    >
      {t('FileManager.config.showFilesInCollection')}
      <Switch size={'small'} value={config.showFilesInSourceSet} />
    </Flexbox>
  );
});

export default Config;
