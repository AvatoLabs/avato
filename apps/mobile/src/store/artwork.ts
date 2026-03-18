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
  batches: GenerationBatch[];
  addBatch: (batch: GenerationBatch) => void;
  hydrate: () => Promise<void>;
  removeBatch: (batchId: string) => void;
  updateBatch: (batchId: string, updater: (b: GenerationBatch) => GenerationBatch) => void;
}

const persistBatches = async (batches: GenerationBatch[]) => {
  try {
    await AsyncStorage.setItem(ARTWORK_HISTORY_KEY, JSON.stringify(batches));
  } catch {
    /* best-effort */
  }
};

export const useArtworkStore = create<ArtworkState>((set, get) => ({
  batches: [],

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(ARTWORK_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GenerationBatch[];
        if (Array.isArray(parsed)) {
          set({ batches: parsed });
        }
      }
    } catch {
      /* */
    }
  },

  addBatch: (batch) => {
    set((s) => {
      const next = [batch, ...s.batches];
      void persistBatches(next);
      return { batches: next };
    });
  },

  updateBatch: (batchId, updater) => {
    set((s) => {
      const next = s.batches.map((b) => (b.id === batchId ? updater(b) : b));
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
