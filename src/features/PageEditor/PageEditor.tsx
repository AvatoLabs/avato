'use client';

import { EditorProvider } from '@lobehub/editor/react';
import { Flexbox } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import type { FC, ReactNode } from 'react';
import { memo } from 'react';

import { CONVERSATION_MIN_WIDTH } from '@/const/layoutTokens';
import DiffAllToolbar from '@/features/EditorCanvas/DiffAllToolbar';
import { useRegisterFilesHotkeys } from '@/hooks/useHotkeys';
import { usePageStore } from '@/store/docs';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { DEFAULT_PAGE_KIND, type PageKind, TABLE_PAGE_KIND } from '@/utils/docs';
import { StyleSheet } from '@/utils/styles';

import { PAGE_EDITOR_SCROLL_ROOT_ID } from './constants';
import Copilot from './Copilot';
import { DocsAgentProvider } from './DocsAgentProvider';
import Header from './Header';
import ModeContent from './ModeContent';
import { PageEditorProvider } from './PageEditorProvider';
import PageTitle from './PageTitle';
import { usePageEditorStore } from './store';
import TitleSection from './TitleSection';

const styles = StyleSheet.create({
  canvasFrame: {
    boxSizing: 'border-box',
    minHeight: '100%',
    width: '100%',
  },
  canvasInner: {
    boxSizing: 'border-box',
    marginInline: 'auto',
    minHeight: '100%',
    paddingInline: 16,
    width: '100%',
  },
  contentWrapper: {
    display: 'flex',
    overflowY: 'auto',
    position: 'relative',
  },
  documentSurface: {
    boxSizing: 'border-box',
    minHeight: '100%',
    paddingBottom: 24,
    paddingInline: 20,
    position: 'relative',
    width: '100%',
  },
  editorContainer: {
    minWidth: 0,
    position: 'relative',
  },
  editorContent: {
    boxSizing: 'border-box',
    minHeight: '100%',
    minWidth: 0,
    position: 'relative',
  },
  workspaceBackground: {
    background: cssVar.colorBgContainer,
  },
});

interface PageEditorProps {
  allowHorizontalScroll?: boolean;
  contentMinWidth?: number;
  emoji?: string;
  onBack?: () => void;
  onDelete?: () => void;
  onDocumentIdChange?: (newId: string) => void;
  onEmojiChange?: (emoji: string | undefined) => void;
  onSave?: () => void;
  onTitleChange?: (title: string) => void;
  pageId?: string;
  pageKind?: PageKind;
  parentId?: string | null;
  sourceSetId?: string;
  title?: string;
}

interface PageEditorCanvasProps {
  allowHorizontalScroll?: boolean;
  contentMinWidth?: number;
  rightPanel?: ReactNode;
}

const PageEditorCanvas = memo<PageEditorCanvasProps>(
  ({ allowHorizontalScroll = false, contentMinWidth, rightPanel }) => {
    const [documentId, editor, pageKind, viewMode] = usePageEditorStore((s) => [
      s.documentId,
      s.editor,
      s.pageKind,
      s.viewMode,
    ]);
    const wideScreen = useGlobalStore(systemStatusSelectors.wideScreen);
    const isTablePage = pageKind === TABLE_PAGE_KIND;
    const canvasWidth = wideScreen
      ? '100%'
      : `min(${contentMinWidth || CONVERSATION_MIN_WIDTH}px, 100%)`;

    // Register Files scope and save document hotkey
    useRegisterFilesHotkeys();

    const content = (
      <div style={styles.editorContent}>
        <TitleSection />
        <ModeContent
          documentId={documentId}
          editor={editor}
          pageKind={pageKind || DEFAULT_PAGE_KIND}
          viewMode={viewMode}
        />
      </div>
    );

    return (
      <>
        <PageTitle />
        <Flexbox horizontal height={'100%'} style={styles.workspaceBackground} width={'100%'}>
          <Flexbox flex={1} height={'100%'} style={styles.editorContainer}>
            <Header />
            <Flexbox
              horizontal
              height={'100%'}
              id={PAGE_EDITOR_SCROLL_ROOT_ID}
              width={'100%'}
              style={{
                ...styles.contentWrapper,
                overflowX: allowHorizontalScroll ? 'auto' : undefined,
              }}
            >
              <div
                style={{
                  minHeight: isTablePage ? undefined : '100%',
                  minWidth: contentMinWidth,
                  width: '100%',
                }}
              >
                {isTablePage ? (
                  <Flexbox paddingInline={20} width={'100%'}>
                    {content}
                  </Flexbox>
                ) : (
                  <div
                    style={{
                      ...styles.canvasFrame,
                      cursor: viewMode === 'rich' && !isTablePage ? 'text' : 'default',
                    }}
                    onClick={() => {
                      if (viewMode === 'rich' && !isTablePage) {
                        editor?.focus();
                      }
                    }}
                  >
                    <div style={{ ...styles.canvasInner, width: canvasWidth }}>
                      <div style={styles.documentSurface}>{content}</div>
                    </div>
                  </div>
                )}
              </div>
            </Flexbox>
            {documentId && editor && viewMode === 'rich' && !isTablePage && (
              <DiffAllToolbar documentId={documentId} editor={editor} />
            )}
          </Flexbox>
          {rightPanel}
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
  sourceSetId,
  onDocumentIdChange,
  onEmojiChange,
  onSave,
  onTitleChange,
  onBack,
  onDelete: onDeleteAfter,
  parentId,
  title,
  emoji,
}) => {
  const deletePage = usePageStore((s) => s.deletePage);

  const handleDeleteNavigate = () => {
    if (pageId) void deletePage(pageId);
    onDeleteAfter?.();
  };

  return (
    <EditorProvider>
      <PageEditorProvider
        emoji={emoji}
        pageId={pageId}
        pageKind={pageKind}
        parentId={parentId}
        sourceSetId={sourceSetId}
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
          rightPanel={
            <DocsAgentProvider fallback={<Copilot loading />}>
              <Copilot />
            </DocsAgentProvider>
          }
        />
      </PageEditorProvider>
    </EditorProvider>
  );
};
