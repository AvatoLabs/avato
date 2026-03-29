import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';
import { enableMapSet } from 'immer';
import { scan } from 'react-scan';

import {
  cleanupChunkReloadMarker,
  isChunkLoadError,
  notifyChunkError,
  tryHardReloadForChunkError,
} from '@/utils/chunkError';

enableMapSet();

// Dayjs plugins - extend once at app init to avoid duplicate extensions in components
dayjs.extend(relativeTime);
dayjs.extend(utc);
dayjs.extend(isToday);
dayjs.extend(isYesterday);

// Global fallback: catch async chunk-load failures that escape Error Boundaries
if (typeof window !== 'undefined') {
  cleanupChunkReloadMarker();

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    if (!tryHardReloadForChunkError()) {
      notifyChunkError();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    if (isChunkLoadError(event.reason)) {
      event.preventDefault();
      if (!tryHardReloadForChunkError()) {
        notifyChunkError();
      }
    }
  });
}

if (__DEV__ && process.env.NEXT_PUBLIC_ENABLE_REACT_SCAN === '1') {
  scan({ enabled: true });
}
