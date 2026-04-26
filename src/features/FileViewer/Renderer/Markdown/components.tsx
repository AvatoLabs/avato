'use client';

import {
  ActionIcon,
  CopyButton,
  Flexbox,
  Highlighter,
  type MarkdownProps,
  SyntaxMermaid,
  Tag,
} from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { Maximize2 } from 'lucide-react';
import { type ComponentPropsWithoutRef, memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { extractMarkdownCodeBlock, type MarkdownPreviewSettings } from './utils';

const styles = createStaticStyles(({ css, cssVar }) => ({
  codeViewport: css`
    scrollbar-gutter: stable both-edges;

    overflow: auto hidden;
    overscroll-behavior-x: contain;

    width: 100%;
    min-width: 0;
    max-width: 100%;
    padding-block-end: 6px;

    pre {
      overflow-x: visible !important;
      min-width: max-content;
    }
  `,
  diagramBody: css`
    padding-block: ${cssVar.paddingSM} ${cssVar.paddingMD};
    padding-inline: ${cssVar.paddingSM};
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};
  `,
  diagramHeader: css`
    padding: ${cssVar.paddingSM};
  `,
  diagramImageViewport: css`
    scrollbar-gutter: stable both-edges;

    overflow: auto;
    overscroll-behavior-x: contain;

    width: 100%;
    min-width: 0;
    max-width: 100%;
    padding-block-end: 6px;

    :global(.ant-mermaid-mermaid img) {
      cursor: zoom-in;

      display: block;

      width: 100%;
      max-height: min(60dvh, 420px);
      border-radius: ${cssVar.borderRadius};

      object-fit: contain;
    }
  `,
  diagramPanel: css`
    overflow: hidden;

    width: 100%;
    min-width: 0;
    margin-block: 1.25rem;
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorFillQuaternary};
    box-shadow: 0 0 0 1px ${cssVar.colorBorderSecondary};
  `,
  tableViewport: css`
    scrollbar-gutter: stable both-edges;

    overflow: auto hidden;
    overscroll-behavior-x: contain;

    width: 100%;
    min-width: 0;
    max-width: 100%;
    margin-block: 1.25rem;
    padding-block-end: 6px;

    table {
      width: max-content !important;
      min-width: 100%;
      max-width: none !important;
      margin-block: 0 !important;
    }
  `,
}));

type MarkdownTableProps = ComponentPropsWithoutRef<'table'> & { node?: unknown };
type MarkdownPreProps = ComponentPropsWithoutRef<'pre'> & { node?: unknown };

const MarkdownPreviewTable = memo<MarkdownTableProps>(({ node: _node, ...props }) => {
  return (
    <div className={styles.tableViewport}>
      <table {...props} />
    </div>
  );
});

MarkdownPreviewTable.displayName = 'MarkdownPreviewTable';

interface MarkdownPreviewMermaidBlockProps {
  content: string;
  mermaidTheme?: MarkdownPreviewSettings['mermaidTheme'];
}

export const MermaidDiagramPanel = memo<MarkdownPreviewMermaidBlockProps>(
  ({ content, mermaidTheme }) => {
    const { t } = useTranslation('file');
    const containerRef = useRef<HTMLDivElement>(null);
    const openPreview = () => {
      containerRef.current?.querySelector('img')?.click();
    };

    return (
      <div className={styles.diagramPanel} data-code-type="mermaid">
        <Flexbox
          horizontal
          align={'center'}
          className={styles.diagramHeader}
          justify={'space-between'}
        >
          <Tag>{'mermaid'}</Tag>
          <Flexbox horizontal gap={4}>
            <CopyButton content={() => content} size={'small'} />
            <ActionIcon
              icon={Maximize2}
              title={t('preview.diagramOpenLarge')}
              onClick={openPreview}
            />
          </Flexbox>
        </Flexbox>
        <div className={styles.diagramBody}>
          <div className={styles.diagramImageViewport} ref={containerRef}>
            <SyntaxMermaid theme={mermaidTheme} variant={'filled'}>
              {content}
            </SyntaxMermaid>
          </div>
        </div>
      </div>
    );
  },
);

MermaidDiagramPanel.displayName = 'MermaidDiagramPanel';

interface MarkdownPreviewPreProps extends MarkdownPreProps {
  highlighterTheme?: MarkdownPreviewSettings['highlighterTheme'];
  mermaidTheme?: MarkdownPreviewSettings['mermaidTheme'];
}

const MarkdownPreviewPre = memo<MarkdownPreviewPreProps>(
  ({ children, highlighterTheme, mermaidTheme, node: _node, ...props }) => {
    const codeBlock = extractMarkdownCodeBlock(children);

    if (!codeBlock) return <pre {...props}>{children}</pre>;

    if (codeBlock.language.toLowerCase() === 'mermaid') {
      return <MermaidDiagramPanel content={codeBlock.content} mermaidTheme={mermaidTheme} />;
    }

    return (
      <Highlighter
        fullFeatured
        bodyRender={({ originalNode }) => <div className={styles.codeViewport}>{originalNode}</div>}
        language={codeBlock.language}
        theme={highlighterTheme}
        variant={'filled'}
      >
        {codeBlock.content}
      </Highlighter>
    );
  },
);

MarkdownPreviewPre.displayName = 'MarkdownPreviewPre';

interface MarkdownPreviewComponentSettings extends Pick<
  MarkdownPreviewSettings,
  'highlighterTheme' | 'mermaidTheme'
> {}

export const createMarkdownPreviewComponents = ({
  highlighterTheme,
  mermaidTheme,
}: MarkdownPreviewComponentSettings): NonNullable<MarkdownProps['components']> => ({
  pre: (props) => (
    <MarkdownPreviewPre
      {...(props as MarkdownPreProps)}
      highlighterTheme={highlighterTheme}
      mermaidTheme={mermaidTheme}
    />
  ),
  table: (props) => <MarkdownPreviewTable {...(props as MarkdownTableProps)} />,
});
