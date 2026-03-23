'use client';

import { type IEditor } from '@lobehub/editor';
import { CodeEditor, Flexbox, Markdown, Skeleton } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { editorSelectors, useDocumentStore } from '@/store/document';

import RichEditorCanvas from './EditorCanvas';
import { type PageEditorViewMode } from './store/initialState';

interface ModeContentProps {
  documentId?: string;
  editor?: IEditor;
  viewMode: PageEditorViewMode;
}

const ModeContent = memo<ModeContentProps>(({ documentId, editor, viewMode }) => {
  const { t } = useTranslation('file');
  const [markdownValue, setMarkdownValue] = useState('');

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

  return (
    <>
      <div style={{ display: viewMode === 'rich' ? undefined : 'none', minHeight: 0 }}>
        <RichEditorCanvas />
      </div>
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
              placeholder={t('pageEditor.editorPlaceholder')}
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
              <Markdown>{markdownValue}</Markdown>
            </Flexbox>
          )}
        </Flexbox>
      )}
    </>
  );
});

ModeContent.displayName = 'ModeContent';

export default ModeContent;
