'use client';

import { Empty, Flexbox, Segmented } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo, useEffect, useMemo, useState } from 'react';

import CircleLoading from '@/components/Loading/CircleLoading';
import { CustomMDX } from '@/components/mdx';
import { documentService } from '@/services/document';
import { type LobeDocument } from '@/types/document';

import { usePageAgentContextFallback } from '../../hooks/usePageAgentContextFallback';
import NotSupport from '../../NotSupport';

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    width: 100%;
    height: 100%;
    padding: ${cssVar.paddingLG};
    background: ${cssVar.colorBgContainer};
  `,
  content: css`
    width: max-content;
    min-width: 100%;
  `,
  markdown: css`
    overflow: auto;
    flex: 1;

    min-width: 0;
    min-height: 0;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG}px;

    background: ${cssVar.colorBgElevated};
  `,
  markdownInner: css`
    overflow: auto;
    width: max-content;
    min-width: 100%;
    padding: ${cssVar.paddingLG};

    table {
      display: table;
      border-collapse: collapse;

      width: max-content;
      min-width: 100%;
      max-width: none;
    }
  `,
  segmented: css`
    width: fit-content;
    max-width: 100%;
  `,
}));

interface ExcelViewerProps {
  enablePageAgentContext?: boolean;
  fileId: string;
  fileName?: string;
  pageAgentContextKey?: string;
  url: string | null;
}

const ExcelViewer = memo<ExcelViewerProps>(
  ({ enablePageAgentContext, fileId, fileName, pageAgentContextKey, url }) => {
    const [preview, setPreview] = useState<LobeDocument | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeSheet, setActiveSheet] = useState<string>();

    useEffect(() => {
      let cancelled = false;

      const loadPreview = async () => {
        try {
          setLoading(true);
          setError(false);

          const result = await documentService.previewFileContent(fileId);
          if (cancelled) return;

          setPreview(result);
          setActiveSheet(result.pages?.[0]?.metadata?.sheetName || undefined);
        } catch (error_) {
          if (cancelled) return;

          console.error('[ExcelViewer] Failed to preview file:', error_);
          setPreview(null);
          setError(true);
        } finally {
          if (!cancelled) setLoading(false);
        }
      };

      void loadPreview();

      return () => {
        cancelled = true;
      };
    }, [fileId]);

    const pages = useMemo(() => preview?.pages || [], [preview?.pages]);

    const sheetOptions = useMemo(
      () =>
        pages.map((page, index) => ({
          label: page.metadata?.sheetName || `${index + 1}`,
          value: page.metadata?.sheetName || `${index + 1}`,
        })),
      [pages],
    );

    const selectedSheet =
      pages.find((page, index) => {
        const key = page.metadata?.sheetName || `${index + 1}`;
        return key === activeSheet;
      }) || pages[0];

    const currentContent = selectedSheet?.pageContent || preview?.content || '';

    usePageAgentContextFallback({
      contextKey: pageAgentContextKey,
      enabled: enablePageAgentContext,
      fileId,
      fileName,
      text: currentContent,
    });

    if (loading) {
      return <CircleLoading />;
    }

    if (error) {
      return <NotSupport fileName={fileName} url={url} />;
    }

    if (!currentContent) {
      return (
        <Flexbox className={styles.container}>
          <Empty />
        </Flexbox>
      );
    }

    return (
      <Flexbox className={styles.container} gap={12}>
        {sheetOptions.length > 1 && (
          <Segmented
            block={false}
            className={styles.segmented}
            options={sheetOptions}
            value={activeSheet || sheetOptions[0]?.value}
            onChange={(value) => setActiveSheet(String(value))}
          />
        )}
        <div className={styles.markdown}>
          <div className={styles.markdownInner}>
            <div className={styles.content}>
              <CustomMDX source={currentContent} />
            </div>
          </div>
        </div>
      </Flexbox>
    );
  },
);

ExcelViewer.displayName = 'ExcelViewer';

export default ExcelViewer;
