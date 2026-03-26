'use client';

import { EditorProvider } from '@lobehub/editor/react';
import { Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import type { FC } from 'react';
import { memo } from 'react';

import DiffAllToolbar from '@/features/EditorCanvas/DiffAllToolbar';
import WideScreenContainer from '@/features/WideScreenContainer';
import { useRegisterFilesHotkeys } from '@/hooks/useHotkeys';
import { usePageStore } from '@/store/page';
import { DEFAULT_PAGE_KIND, type PageKind, TABLE_PAGE_KIND } from '@/utils/page';
import { StyleSheet } from '@/utils/styles';

import Copilot from './Copilot';
import Header from './Header';
import ModeContent from './ModeContent';
import { PageAgentProvider } from './PageAgentProvider';
import { PageEditorProvider } from './PageEditorProvider';
import PageTitle from './PageTitle';
import { usePageEditorStore } from './store';
import TitleSection from './TitleSection';

const styles = StyleSheet.create({
  contentWrapper: {
    display: 'flex',
    overflowY: 'auto',
    position: 'relative',
  },
  editorContainer: {
    minWidth: 0,
    position: 'relative',
  },
  editorContent: {
    overflowY: 'auto',
    position: 'relative',
  },
});

interface PageEditorProps {
  allowHorizontalScroll?: boolean;
  contentMinWidth?: number;
  emoji?: string;
  knowledgeBaseId?: string;
  onBack?: () => void;
  onDelete?: () => void;
  onDocumentIdChange?: (newId: string) => void;
  onEmojiChange?: (emoji: string | undefined) => void;
  onSave?: () => void;
  onTitleChange?: (title: string) => void;
  pageId?: string;
  pageKind?: PageKind;
  title?: string;
}

interface PageEditorCanvasProps {
  allowHorizontalScroll?: boolean;
  contentMinWidth?: number;
}

const PageEditorCanvas = memo<PageEditorCanvasProps>(
  ({ allowHorizontalScroll = false, contentMinWidth }) => {
    const [documentId, editor, pageKind, viewMode] = usePageEditorStore((s) => [
      s.documentId,
      s.editor,
      s.pageKind,
      s.viewMode,
    ]);
    const isTablePage = pageKind === TABLE_PAGE_KIND;

    // Register Files scope and save document hotkey
    useRegisterFilesHotkeys();

    return (
      <>
        <PageTitle />
        <Flexbox
          horizontal
          height={'100%'}
          style={{ backgroundColor: cssVar.colorBgContainer }}
          width={'100%'}
        >
          <Flexbox flex={1} height={'100%'} style={styles.editorContainer}>
            <Header />
            <Flexbox
              horizontal
              height={'100%'}
              width={'100%'}
              style={{
                ...styles.contentWrapper,
                overflowX: allowHorizontalScroll ? 'auto' : undefined,
              }}
            >
              <div style={{ minWidth: contentMinWidth, width: '100%' }}>
                <WideScreenContainer
                  wrapperStyle={{
                    cursor: viewMode === 'rich' && !isTablePage ? 'text' : 'default',
                  }}
                  onClick={() => {
                    if (viewMode === 'rich' && !isTablePage) {
                      editor?.focus();
                    }
                  }}
                >
                  <Flexbox flex={1} style={styles.editorContent}>
                    <TitleSection />
                    <ModeContent
                      documentId={documentId}
                      editor={editor}
                      pageKind={pageKind || DEFAULT_PAGE_KIND}
                      viewMode={viewMode}
                    />
                  </Flexbox>
                </WideScreenContainer>
              </div>
            </Flexbox>
            {documentId && editor && viewMode === 'rich' && !isTablePage && (
              <DiffAllToolbar documentId={documentId} editor={editor} />
            )}
          </Flexbox>
          <Copilot />
        </Flexbox>
      </>
    );
  },
);

/**
 * Edit a page
 *
 * A reusable component. Should NOT depend on context.
 */
export const PageEditor: FC<PageEditorProps> = ({
  allowHorizontalScroll,
  contentMinWidth,
  pageId,
  pageKind = DEFAULT_PAGE_KIND,
  knowledgeBaseId,
  onDocumentIdChange,
  onEmojiChange,
  onSave,
  onTitleChange,
  onBack,
  onDelete: onDeleteAfter,
  title,
  emoji,
}) => {
  const deletePage = usePageStore((s) => s.deletePage);

  const handleDeleteNavigate = () => {
    if (pageId) void deletePage(pageId);
    onDeleteAfter?.();
  };

  return (
    <PageAgentProvider>
      <EditorProvider>
        <PageEditorProvider
          emoji={emoji}
          knowledgeBaseId={knowledgeBaseId}
          pageId={pageId}
          pageKind={pageKind}
          title={title}
          onBack={onBack}
          onDelete={handleDeleteNavigate}
          onDocumentIdChange={onDocumentIdChange}
          onEmojiChange={onEmojiChange}
          onSave={onSave}
          onTitleChange={onTitleChange}
        >
          <PageEditorCanvas
            allowHorizontalScroll={allowHorizontalScroll}
            contentMinWidth={contentMinWidth}
          />
        </PageEditorProvider>
      </EditorProvider>
    </PageAgentProvider>
  );
};
