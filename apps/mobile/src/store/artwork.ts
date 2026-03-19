/**
 * Artwork store — persists generation history locally only (no remote sync).
 *
 * Generated images are stored on the remote server (createImage API).
 * This store keeps a local history of batches for display; it does not
 * load from or sync with the remote generation topic/batches API.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import type { GenerationBatch } from '../types';

const ARTWORK_HISTORY_KEY = 'avato_artwork_history';

interface ArtworkState {
  addBatch: (batch: GenerationBatch) => void;
  batches: GenerationBatch[];
  hydrate: () => Promise<void>;
  removeBatch: (batchId: string) => void;
  updateBatch: (batchId: string, updater: (b: GenerationBatch) => GenerationBatch) => void;
}

const sortArtworkBatches = (batches: GenerationBatch[]) =>
  [...batches].sort((left, right) => {
    const leftTime = new Date(left.createdAt ?? left.updatedAt ?? 0).getTime();
    const rightTime = new Date(right.createdAt ?? right.updatedAt ?? 0).getTime();

    return leftTime - rightTime;
  });

const persistBatches = async (batches: GenerationBatch[]) => {
  try {
    await AsyncStorage.setItem(ARTWORK_HISTORY_KEY, JSON.stringify(batches));
  } catch {
    /* best-effort */
  }
};

export const useArtworkStore = create<ArtworkState>((set) => ({
  batches: [],

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(ARTWORK_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GenerationBatch[];
        if (Array.isArray(parsed)) {
          set({ batches: sortArtworkBatches(parsed) });
        }
      }
    } catch {
      /* */
    }
  },

  addBatch: (batch) => {
    set((s) => {
      const next = sortArtworkBatches([...s.batches.filter((item) => item.id !== batch.id), batch]);
      void persistBatches(next);
      return { batches: next };
    });
  },

  updateBatch: (batchId, updater) => {
    set((s) => {
      const next = sortArtworkBatches(s.batches.map((b) => (b.id === batchId ? updater(b) : b)));
      void persistBatches(next);
      return { batches: next };
    });
  },

  removeBatch: (batchId) => {
    set((s) => {
      const next = s.batches.filter((b) => b.id !== batchId);
      void persistBatches(next);
      return { batches: next };
    });
  },
}));
