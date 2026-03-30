'use client';

import type { BuiltinInspectorProps } from '@lobechat/types';
import { createStaticStyles, cx } from 'antd-style';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { oneLineEllipsis, shinyTextStyles } from '@/styles';

const styles = createStaticStyles(({ css, cssVar }) => ({
  done: css`
    color: ${cssVar.colorTextDescription};
  `,
}));

export const GetDocContentInspector = memo<BuiltinInspectorProps>(({ isArgumentsStreaming }) => {
  const { t } = useTranslation('plugin');

  return (
    <div
      className={cx(
        oneLineEllipsis,
        isArgumentsStreaming ? shinyTextStyles.shinyText : styles.done,
      )}
    >
      <span>{t('builtins.lobe-docs-agent.apiName.getDocContent')}</span>
    </div>
  );
});

GetDocContentInspector.displayName = 'GetDocContentInspector';

export default GetDocContentInspector;
