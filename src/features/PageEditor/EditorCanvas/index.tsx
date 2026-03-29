'use client';

import { type CSSProperties } from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { EditorCanvas as SharedEditorCanvas } from '@/features/EditorCanvas';

import { usePageEditorStore } from '../store';
import { useAskCopilotItem } from './useAskCopilotItem';
import { useSlashItems } from './useSlashItems';

interface EditorCanvasProps {
  placeholder?: string;
  style?: CSSProperties;
}

const EditorCanvas = memo<EditorCanvasProps>(({ placeholder, style }) => {
  const { t } = useTranslation(['file', 'ui']);

  const [documentId, editor, performMetaSave] = usePageEditorStore((s) => [
    s.documentId,
    s.editor,
    s.performMetaSave,
  ]);

  const slashItems = useSlashItems();
  const askCopilotItem = useAskCopilotItem(editor);
  const beforeAutoSave = async () => {
    await performMetaSave();
  };

  return (
    <SharedEditorCanvas
      documentId={documentId}
      editor={editor}
      placeholder={placeholder || t('docEditor.editorPlaceholder')}
      slashItems={slashItems}
      style={style}
      toolbarExtraItems={askCopilotItem}
      unsavedChangesGuard={{
        beforeAutoSave,
        enabled: true,
        message: t('form.unsavedWarning', { ns: 'ui' }),
        title: t('form.unsavedChanges', { ns: 'ui' }),
      }}
    />
  );
});

export default EditorCanvas;
