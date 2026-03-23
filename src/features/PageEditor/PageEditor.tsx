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
  emoji?: string;
  knowledgeBaseId?: string;
  onBack?: () => void;
  onDelete?: () => void;
  onDocumentIdChange?: (newId: string) => void;
  onEmojiChange?: (emoji: string | undefined) => void;
  onSave?: () => void;
  onTitleChange?: (title: string) => void;
  pageId?: string;
  title?: string;
}

const PageEditorCanvas = memo(() => {
  const [documentId, editor, viewMode] = usePageEditorStore((s) => [
    s.documentId,
    s.editor,
    s.viewMode,
  ]);

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
          <Flexbox horizontal height={'100%'} style={styles.contentWrapper} width={'100%'}>
            <WideScreenContainer
              wrapperStyle={{ cursor: viewMode === 'rich' ? 'text' : 'default' }}
              onClick={() => {
                if (viewMode === 'rich') {
                  editor?.focus();
                }
              }}
            >
              <Flexbox flex={1} style={styles.editorContent}>
                <TitleSection />
                <ModeContent documentId={documentId} editor={editor} viewMode={viewMode} />
              </Flexbox>
            </WideScreenContainer>
          </Flexbox>
          {documentId && editor && viewMode === 'rich' && (
            <DiffAllToolbar documentId={documentId} editor={editor} />
          )}
        </Flexbox>
        <Copilot />
      </Flexbox>
    </>
  );
});

/**
 * Edit a page
 *
 * A reusable component. Should NOT depend on context.
 */
export const PageEditor: FC<PageEditorProps> = ({
  pageId,
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
          title={title}
          onBack={onBack}
          onDelete={handleDeleteNavigate}
          onDocumentIdChange={onDocumentIdChange}
          onEmojiChange={onEmojiChange}
          onSave={onSave}
          onTitleChange={onTitleChange}
        >
          <PageEditorCanvas />
        </PageEditorProvider>
      </EditorProvider>
    </PageAgentProvider>
  );
};
