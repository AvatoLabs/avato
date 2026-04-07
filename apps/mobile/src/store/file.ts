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

interface FileState {
  addChatContextSelection: (context: ChatContextSelection) => void;
  addFile: (file: Omit<FileAttachment, 'status' | 'progress'>) => void;

  chatContextSelections: ChatContextSelection[];
  clearChatContextSelections: () => void;
  clearPending: () => void;
  pendingFiles: FileAttachment[];
  removeChatContextSelection: (id: string) => void;
  removeFile: (id: string) => void;
  uploadAll: () => Promise<void>;
  uploadFile: (id: string, options?: { sessionId?: string }) => Promise<UploadedFileResult | null>;
}

export const useFileStore = create<FileState>((set, get) => ({
  chatContextSelections: [],
  pendingFiles: [],

  addFile: (file) => {
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
    set((s) => ({ pendingFiles: [...s.pendingFiles, attachment] }));
  },

  addChatContextSelection: (context) => {
    set((s) => ({
      chatContextSelections: [
        ...s.chatContextSelections.filter((item) => item.id !== context.id),
        context,
      ],
    }));
  },

  removeFile: (id) => {
    set((s) => ({ pendingFiles: s.pendingFiles.filter((f) => f.id !== id) }));
  },

  removeChatContextSelection: (id) => {
    set((s) => ({
      chatContextSelections: s.chatContextSelections.filter((context) => context.id !== id),
    }));
  },

  uploadFile: async (id: string, options?: { sessionId?: string }) => {
    const file = get().pendingFiles.find((f) => f.id === id);
    if (!file) return null;

    if (file.fileId && file.url) {
      if (isCanonicalDocumentItem({ id: file.fileId, kind: 'file' })) {
        const t = useI18n.getState().t;
        useToast.getState().show('error', t.fileUploadFailed);
        set((s) => ({ pendingFiles: s.pendingFiles.filter((f) => f.id !== id) }));
        return null;
      }
      return { fileId: file.fileId, url: file.url };
    }

    set((s) => ({
      pendingFiles: s.pendingFiles.map((f) =>
        f.id === id ? { ...f, status: 'uploading' as const, progress: 0 } : f,
      ),
    }));

    try {
      const result = await fileApi.upload(file.uri, file.name, file.type, {
        onProgress: (progress) => {
          set((s) => ({
            pendingFiles: s.pendingFiles.map((pendingFile) =>
              pendingFile.id === id
                ? {
                    ...pendingFile,
                    progress,
                    status: 'uploading' as const,
                  }
                : pendingFile,
            ),
          }));
        },
        sessionId: options?.sessionId,
      });

      set((s) => ({
        pendingFiles: s.pendingFiles.map((f) =>
          f.id === id
            ? {
                ...f,
                fileId: result.id,
                status: 'done' as const,
                progress: 100,
                url: result.url,
              }
            : f,
        ),
      }));

      return { fileId: result.id, url: result.url };
    } catch {
      const t = useI18n.getState().t;
      useToast.getState().show('error', t.fileUploadError, {
        onRetry: () => void get().uploadFile(id, options),
      });
      set((s) => ({
        pendingFiles: s.pendingFiles.map((f) =>
          f.id === id ? { ...f, status: 'error' as const } : f,
        ),
      }));
      return null;
    }
  },

  uploadAll: async () => {
    const pending = get().pendingFiles.filter((f) => f.status === 'pending');
    await Promise.all(pending.map((f) => get().uploadFile(f.id)));
  },

  clearPending: () => {
    set({ pendingFiles: [] });
  },

  clearChatContextSelections: () => {
    set({ chatContextSelections: [] });
  },
}));
