import { type IEditor } from '@lobehub/editor';

import { DEFAULT_PAGE_KIND, type PageKind } from '@/utils/page';

export type MetaSaveStatus = 'idle' | 'saving' | 'saved';
export type PageEditorViewMode = 'markdown' | 'preview' | 'rich';

export interface PublicState {
  autoSave?: boolean;
  emoji?: string;
  knowledgeBaseId?: string;
  onBack?: () => void;
  onDelete?: () => void;
  onDocumentIdChange?: (newId: string) => void;
  onEmojiChange?: (emoji: string | undefined) => void;
  onSave?: () => void;
  onTitleChange?: (title: string) => void;
  pageKind?: PageKind;
  parentId?: string;
  title?: string;
}

export interface State extends PublicState {
  documentId: string | undefined;
  editor?: IEditor;
  isMetaDirty?: boolean;
  lastSavedEmoji?: string;
  lastSavedTitle?: string;
  metaSaveStatus?: MetaSaveStatus;
  viewMode: PageEditorViewMode;
}

export const initialState: State = {
  autoSave: true,
  documentId: undefined,
  emoji: undefined,
  isMetaDirty: false,
  metaSaveStatus: 'idle',
  pageKind: DEFAULT_PAGE_KIND,
  title: undefined,
  viewMode: 'rich',
};
