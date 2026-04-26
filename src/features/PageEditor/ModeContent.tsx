'use client';

import { type IEditor } from '@lobehub/editor';
import { CodeEditor, Flexbox, Markdown, Skeleton } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { documentMarkdownRemarkPlugins } from '@/libs/markdown/remarkEncodedBreakTag';
import { editorSelectors, useDocumentStore } from '@/store/document';

import RichEditorCanvas from './EditorCanvas';
import { type PublicState } from './store';
import { type PageEditorViewMode } from './store/initialState';
import TableSheet from './TableSheet';

interface ModeContentProps {
  documentId?: string;
  editor?: IEditor;
  pageKind: NonNullable<PublicState['pageKind']>;
  viewMode: PageEditorViewMode;
}

const HIDDEN_EDITOR_STYLE = {
  height: 0,
  minHeight: 0,
  opacity: 0,
  overflow: 'hidden',
  pointerEvents: 'none' as const,
  position: 'absolute' as const,
  width: 1,
};

const ModeContent = memo<ModeContentProps>(({ documentId, editor, pageKind, viewMode }) => {
  const { t } = useTranslation('file');
  const [markdownValue, setMarkdownValue] = useState('');
  const isTablePage = pageKind === 'table';

  const documentMarkdown = useDocumentStore((s) =>
    documentId ? editorSelectors.content(documentId)(s) : '',
  );
  const isDocumentLoading = useDocumentStore((s) =>
    documentId ? editorSelectors.isDocumentLoading(documentId)(s) : false,
  );

  useEffect(() => {
    setMarkdownValue(documentMarkdown);
  }, [documentId, documentMarkdown]);

  useEffect(() => {
    if (viewMode === 'rich' || !editor) return;

    try {
      const currentMarkdown = (editor.getDocument('markdown') as unknown as string) || '';
      setMarkdownValue((value) => (currentMarkdown === value ? value : currentMarkdown));
    } catch (error) {
      console.error('[PageEditor] Failed to read markdown from editor:', error);
    }
  }, [documentId, editor, viewMode]);

  const handleMarkdownChange = (value: string) => {
    setMarkdownValue(value);

    try {
      editor?.setDocument('markdown', value, { keepId: true });
    } catch (error) {
      console.error('[PageEditor] Failed to sync markdown source:', error);
    }
  };

  const handleTableMarkdownCommit = (value: string) => {
    setMarkdownValue(value);

    try {
      editor?.setDocument('markdown', value, { keepId: true });
      useDocumentStore.getState().handleContentChange();
    } catch (error) {
      if (documentId) {
        useDocumentStore.getState().syncExternalDocumentContent(documentId, { content: value });
        return;
      }

      console.error('[PageEditor] Failed to sync table source:', error);
    }
  };

  return (
    <>
      <div
        aria-hidden={isTablePage && viewMode === 'rich'}
        style={
          viewMode !== 'rich'
            ? { display: 'none', minHeight: 0 }
            : isTablePage
              ? HIDDEN_EDITOR_STYLE
              : { minHeight: 0 }
        }
      >
        <RichEditorCanvas />
      </div>
      {viewMode === 'rich' && isTablePage && (
        <TableSheet markdownValue={markdownValue} onMarkdownCommit={handleTableMarkdownCommit} />
      )}
      {viewMode !== 'rich' && (
        <Flexbox
          flex={1}
          gap={16}
          style={{
            border: `1px solid ${cssVar.colorBorderSecondary}`,
            borderRadius: cssVar.borderRadiusLG,
            minHeight: 320,
            overflow: 'hidden',
          }}
        >
          {isDocumentLoading && !markdownValue ? (
            <div style={{ padding: 24 }}>
              <Skeleton active paragraph={{ rows: 8 }} />
            </div>
          ) : viewMode === 'markdown' ? (
            <CodeEditor
              flex={1}
              height={'100%'}
              language={'markdown'}
              placeholder={t('docEditor.editorPlaceholder')}
              value={markdownValue}
              variant={'borderless'}
              styles={{
                highlight: {
                  height: '100%',
                  overflow: 'auto',
                  padding: 16,
                },
                textarea: {
                  height: '100%',
                  overflow: 'auto',
                  padding: 16,
                },
              }}
              onValueChange={handleMarkdownChange}
            />
          ) : (
            <Flexbox
              flex={1}
              padding={16}
              style={{
                overflow: 'auto',
              }}
            >
              <Markdown remarkPluginsAhead={[...documentMarkdownRemarkPlugins]}>
                {markdownValue}
              </Markdown>
            </Flexbox>
          )}
        </Flexbox>
      )}
    </>
  );
});

ModeContent.displayName = 'ModeContent';

export default ModeContent;
