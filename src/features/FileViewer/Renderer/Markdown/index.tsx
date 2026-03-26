'use client';

import { Center, Flexbox, Markdown } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import CircleLoading from '@/components/Loading/CircleLoading';

import { usePageAgentContextFallback } from '../../hooks/usePageAgentContextFallback';
import { useTextFileLoader } from '../../hooks/useTextFileLoader';

const styles = createStaticStyles(({ css, cssVar }) => ({
  page: css`
    width: 100%;
    padding: ${cssVar.paddingLG};
    background: ${cssVar.colorBgContainer};
  `,
}));

interface MarkdownViewerProps {
  enablePageAgentContext?: boolean;
  fileId: string;
  fileName?: string;
  pageAgentContextKey?: string;
  url: string | null;
}

const MarkdownViewer = memo<MarkdownViewerProps>(
  ({ enablePageAgentContext, fileId, fileName, pageAgentContextKey, url }) => {
    const { fileData, loading } = useTextFileLoader(url);
    usePageAgentContextFallback({
      contextKey: pageAgentContextKey,
      enabled: enablePageAgentContext,
      fileId,
      fileName,
      text: fileData,
    });

    return (
      <Flexbox className={styles.page} id="markdown-renderer">
        {!loading && fileData !== null ? (
          <Markdown>{fileData}</Markdown>
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
