/**
 * File store — manages pending file attachments for chat messages.
 */
import { create } from 'zustand';

import { useToast } from '../components/ui/Toast';
import { fileApi } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { isCanonicalDocumentItem } from '../lib/resourceList';
import type { ChatContextSelection, FileAttachment } from '../types';

export interface UploadedFileResult {
  fileId: string;
  url: string;
}

interface PendingFileOptions {
  sessionId?: string;
}

interface ClearPendingOptions extends PendingFileOptions {
  all?: boolean;
}

interface FileState {
  addChatContextSelection: (context: ChatContextSelection) => void;
  addFile: (
    file: Omit<FileAttachment, 'status' | 'progress'>,
    options?: PendingFileOptions,
  ) => void;
  addSessionChatContextSelection: (sessionId: string, context: ChatContextSelection) => void;

  chatContextSelections: ChatContextSelection[];
  clearChatContextSelections: () => void;
  clearPending: (options?: ClearPendingOptions) => void;
  clearSessionChatContextSelections: (sessionId: string) => void;
  pendingFiles: FileAttachment[];
  removeChatContextSelection: (id: string) => void;
  removeFile: (id: string, options?: PendingFileOptions) => void;
  removeSessionChatContextSelection: (sessionId: string, id: string) => void;
  sessionChatContextSelections: Record<string, ChatContextSelection[]>;
  sessionPendingFiles: Record<string, FileAttachment[]>;
  uploadAll: (options?: PendingFileOptions) => Promise<void>;
  uploadFile: (id: string, options?: PendingFileOptions) => Promise<UploadedFileResult | null>;
}

type PendingFileStateSlice = Pick<FileState, 'pendingFiles' | 'sessionPendingFiles'>;

const EMPTY_PENDING_FILES: FileAttachment[] = [];

const getPendingFilesSnapshot = (state: PendingFileStateSlice, sessionId?: string) =>
  sessionId ? (state.sessionPendingFiles[sessionId] ?? EMPTY_PENDING_FILES) : state.pendingFiles;

const updatePendingFilesSnapshot = (
  state: FileState,
  updater: (files: FileAttachment[]) => FileAttachment[],
  sessionId?: string,
) => {
  if (!sessionId) {
    const nextPendingFiles = updater(state.pendingFiles);
    return nextPendingFiles === state.pendingFiles ? state : { pendingFiles: nextPendingFiles };
  }

  const currentPendingFiles = state.sessionPendingFiles[sessionId] ?? EMPTY_PENDING_FILES;
  const nextPendingFiles = updater(currentPendingFiles);

  if (nextPendingFiles === currentPendingFiles) return state;

  if (nextPendingFiles.length === 0) {
    const { [sessionId]: _, ...rest } = state.sessionPendingFiles;
    return { sessionPendingFiles: rest };
  }

  return {
    sessionPendingFiles: {
      ...state.sessionPendingFiles,
      [sessionId]: nextPendingFiles,
    },
  };
};

export const useFileStore = create<FileState>((set, get) => ({
  chatContextSelections: [],
  pendingFiles: [],
  sessionChatContextSelections: {},
  sessionPendingFiles: {},

  addFile: (file, options) => {
    const alreadyUploaded = 'fileId' in file && 'url' in file && !!file.fileId && !!file.url;
    if (
      alreadyUploaded &&
      file.fileId &&
      isCanonicalDocumentItem({ id: file.fileId, kind: 'file' })
    ) {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.fileUploadFailed);
      return;
    }

    const attachment: FileAttachment = {
      ...file,
      progress: alreadyUploaded ? 100 : 0,
      status: alreadyUploaded ? 'done' : 'pending',
    };
    set((s) =>
      updatePendingFilesSnapshot(
        s,
        (pendingFiles) => [...pendingFiles, attachment],
        options?.sessionId,
      ),
    );
  },

  addChatContextSelection: (context) => {
    set((s) => ({
      chatContextSelections: [
        ...s.chatContextSelections.filter((item) => item.id !== context.id),
        context,
      ],
    }));
  },

  addSessionChatContextSelection: (sessionId, context) => {
    if (!sessionId) return;

    set((s) => {
      const current = s.sessionChatContextSelections[sessionId] ?? [];

      return {
        sessionChatContextSelections: {
          ...s.sessionChatContextSelections,
          [sessionId]: [...current.filter((item) => item.id !== context.id), context],
        },
      };
    });
  },

  removeFile: (id, options) => {
    set((s) =>
      updatePendingFilesSnapshot(
        s,
        (pendingFiles) => pendingFiles.filter((file) => file.id !== id),
        options?.sessionId,
      ),
    );
  },

  removeChatContextSelection: (id) => {
    set((s) => ({
      chatContextSelections: s.chatContextSelections.filter((context) => context.id !== id),
    }));
  },

  removeSessionChatContextSelection: (sessionId, id) => {
    if (!sessionId) return;

    set((s) => {
      const current = s.sessionChatContextSelections[sessionId] ?? [];
      const next = current.filter((context) => context.id !== id);

      if (next.length === current.length) return s;

      if (next.length === 0) {
        const { [sessionId]: _, ...rest } = s.sessionChatContextSelections;
        return { sessionChatContextSelections: rest };
      }

      return {
        sessionChatContextSelections: {
          ...s.sessionChatContextSelections,
          [sessionId]: next,
        },
      };
    });
  },

  uploadFile: async (id: string, options) => {
    const file = getPendingFilesSnapshot(get(), options?.sessionId).find(
      (pendingFile) => pendingFile.id === id,
    );
    if (!file) return null;

    if (file.fileId && file.url) {
      if (isCanonicalDocumentItem({ id: file.fileId, kind: 'file' })) {
        const t = useI18n.getState().t;
        useToast.getState().show('error', t.fileUploadFailed);
        set((s) =>
          updatePendingFilesSnapshot(
            s,
            (pendingFiles) => pendingFiles.filter((pendingFile) => pendingFile.id !== id),
            options?.sessionId,
          ),
        );
        return null;
      }
      return { fileId: file.fileId, url: file.url };
    }

    set((s) =>
      updatePendingFilesSnapshot(
        s,
        (pendingFiles) =>
          pendingFiles.map((pendingFile) =>
            pendingFile.id === id
              ? { ...pendingFile, status: 'uploading' as const, progress: 0 }
              : pendingFile,
          ),
        options?.sessionId,
      ),
    );

    try {
      const result = await fileApi.upload(file.uri, file.name, file.type, {
        onProgress: (progress) => {
          set((s) =>
            updatePendingFilesSnapshot(
              s,
              (pendingFiles) =>
                pendingFiles.map((pendingFile) =>
                  pendingFile.id === id
                    ? {
                        ...pendingFile,
                        progress,
                        status: 'uploading' as const,
                      }
                    : pendingFile,
                ),
              options?.sessionId,
            ),
          );
        },
      });

      set((s) =>
        updatePendingFilesSnapshot(
          s,
          (pendingFiles) =>
            pendingFiles.map((pendingFile) =>
              pendingFile.id === id
                ? {
                    ...pendingFile,
                    fileId: result.id,
                    status: 'done' as const,
                    progress: 100,
                    url: result.url,
                  }
                : pendingFile,
            ),
          options?.sessionId,
        ),
      );

      return { fileId: result.id, url: result.url };
    } catch (error) {
      console.warn('[FileStore] Failed to upload pending file', {
        error,
        fileId: id,
        sessionId: options?.sessionId,
      });
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.fileUploadError, {
        onRetry: () => void get().uploadFile(id, options),
      });
      set((s) =>
        updatePendingFilesSnapshot(
          s,
          (pendingFiles) =>
            pendingFiles.map((pendingFile) =>
              pendingFile.id === id ? { ...pendingFile, status: 'error' as const } : pendingFile,
            ),
          options?.sessionId,
        ),
      );
      return null;
    }
  },

  uploadAll: async (options) => {
    const pending = getPendingFilesSnapshot(get(), options?.sessionId).filter(
      (pendingFile) => pendingFile.status === 'pending',
    );
    await Promise.all(pending.map((pendingFile) => get().uploadFile(pendingFile.id, options)));
  },

  clearPending: (options) => {
    if (options?.all) {
      set({ pendingFiles: [], sessionPendingFiles: {} });
      return;
    }

    set((s) => updatePendingFilesSnapshot(s, () => EMPTY_PENDING_FILES, options?.sessionId));
  },

  clearChatContextSelections: () => {
    set({ chatContextSelections: [] });
  },

  clearSessionChatContextSelections: (sessionId) => {
    if (!sessionId) return;

    set((s) => {
      if (!s.sessionChatContextSelections[sessionId]) return s;

      const { [sessionId]: _, ...rest } = s.sessionChatContextSelections;
      return { sessionChatContextSelections: rest };
    });
  },
}));
