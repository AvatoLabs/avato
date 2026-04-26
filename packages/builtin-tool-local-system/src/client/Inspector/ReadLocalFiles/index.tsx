'use client';

import type { LocalReadFilesParams } from '@lobechat/electron-client-ipc';
import type { BuiltinInspectorProps } from '@lobechat/types';
import { createStaticStyles, cx } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { inspectorTextStyles, shinyTextStyles } from '@/styles';

import type { LocalReadFilesState } from '../../..';
import { FilePathDisplay } from '../../components/FilePathDisplay';

const styles = createStaticStyles(({ css }) => ({
  count: css`
    flex-shrink: 0;
    margin-inline-start: 4px;
    font-size: 12px;
    opacity: 0.7;
  `,
}));

export const ReadLocalFilesInspector = memo<
  BuiltinInspectorProps<LocalReadFilesParams, LocalReadFilesState>
>(({ args, partialArgs, isArgumentsStreaming, isLoading }) => {
  const { t } = useTranslation('plugin');
  const maybePaths = args?.paths || partialArgs?.paths;
  const paths = Array.isArray(maybePaths) ? maybePaths : [];
  const firstPath = paths[0] || '';

  const content = (
    <>
      <span>{t('builtins.lobe-local-system.apiName.readLocalFiles')}</span>
      {firstPath && (
        <>
          <span>: </span>
          <FilePathDisplay filePath={firstPath} />
          {paths.length > 1 && <span className={styles.count}>+{paths.length - 1}</span>}
        </>
      )}
    </>
  );

  if (isArgumentsStreaming) {
    return <div className={cx(inspectorTextStyles.root, shinyTextStyles.shinyText)}>{content}</div>;
  }

  return (
    <div className={cx(inspectorTextStyles.root, isLoading && shinyTextStyles.shinyText)}>
      {content}
    </div>
  );
});

ReadLocalFilesInspector.displayName = 'ReadLocalFilesInspector';
