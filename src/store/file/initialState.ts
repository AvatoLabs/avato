import { type ImageFileState } from './slices/chat';
import { initialImageFileState } from './slices/chat';
import { type FileChunkState } from './slices/chunk';
import { initialFileChunkState } from './slices/chunk';
import { type ResourceState } from './slices/content/initialState';
import { initialResourceState } from './slices/content/initialState';
import { type DocumentState } from './slices/document';
import { initialDocumentState } from './slices/document';
import { type FileManagerState } from './slices/fileManager';
import { initialFileManagerState } from './slices/fileManager';

export type FilesStoreState = ImageFileState &
  DocumentState &
  FileManagerState &
  FileChunkState &
  ResourceState;

export const initialState: FilesStoreState = {
  ...initialImageFileState,
  ...initialDocumentState,
  ...initialFileManagerState,
  ...initialFileChunkState,
  ...initialResourceState,
};
