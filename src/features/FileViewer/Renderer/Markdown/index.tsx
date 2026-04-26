'use client';

import { Alert, Center, Flexbox, Markdown } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import CircleLoading from '@/components/Loading/CircleLoading';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';

import { useDocsAgentContextFallback } from '../../hooks/useDocsAgentContextFallback';
import { useTextFileLoader } from '../../hooks/useTextFileLoader';
import { createMarkdownPreviewComponents } from './components';
import { createMarkdownPreviewProps } from './utils';

const styles = createStaticStyles(({ css, cssVar }) => ({
  alert: css`
    width: min(100%, 720px);
  `,
  page: css`
    overflow-x: hidden;

    box-sizing: border-box;
    width: 100%;
    min-height: 100%;
    padding: clamp(16px, 3vw, 32px);

    background: ${cssVar.colorBgLayout};
  `,
  markdown: css`
    overflow: visible !important;

    box-sizing: border-box;
    width: min(100%, 960px);
    min-width: 0;
    margin-inline: auto;
    padding-inline: 0;

    > article {
      overflow: visible !important;
      width: 100%;
      min-width: 0;
      max-width: 100%;
    }

    > article > :first-child {
      margin-block-start: 0;
    }

    > article > :last-child {
      margin-block-end: 0;
    }
  `,
  shell: css`
    width: 100%;
  `,
}));

interface MarkdownViewerProps {
  docsAgentContextKey?: string;
  enableDocsAgentContext?: boolean;
  fileId: string;
  fileName?: string;
  url: string | null;
}

const MarkdownViewer = memo<MarkdownViewerProps>(
  ({ enableDocsAgentContext, fileId, fileName, docsAgentContextKey, url }) => {
    const { t } = useTranslation(['file', 'common']);
    const { fileData, loading, error } = useTextFileLoader(url);
    const { fontSize, highlighterTheme, mermaidTheme } = useUserStore(
      userGeneralSettingsSelectors.config,
    );
    const markdownProps = useMemo(
      () =>
        createMarkdownPreviewProps({
          fontSize,
          highlighterTheme,
          mermaidTheme,
        }),
      [fontSize, highlighterTheme, mermaidTheme],
    );
    const markdownComponents = useMemo(
      () =>
        createMarkdownPreviewComponents({
          highlighterTheme,
          mermaidTheme,
        }),
      [highlighterTheme, mermaidTheme],
    );

    useDocsAgentContextFallback({
      contextKey: docsAgentContextKey,
      enabled: enableDocsAgentContext,
      fileId,
      fileName,
      text: fileData,
    });

    const errorMessage = error?.message || t('common:unknownError');

    return (
      <Flexbox className={styles.page} id="markdown-renderer">
        {!loading && fileData !== null ? (
          <Markdown
            {...markdownProps}
            className={styles.markdown}
            components={markdownComponents}
            style={{ overflow: 'visible' }}
          >
            {fileData}
          </Markdown>
        ) : !loading ? (
          <Center className={styles.shell} width={'100%'}>
            <Alert
              showIcon
              className={styles.alert}
              message={errorMessage}
              title={t('preview.markdownLoadError')}
              type="error"
            />
          </Center>
        ) : (
          <Center height={'100%'}>
            <CircleLoading />
          </Center>
        )}
      </Flexbox>
    );
  },
);

MarkdownViewer.displayName = 'MarkdownViewer';

export default MarkdownViewer;
