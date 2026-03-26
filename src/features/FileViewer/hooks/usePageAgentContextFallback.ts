'use client';

import { useEffect } from 'react';

import { pageAgentRuntime } from '@/store/tool/slices/builtin/executors/lobe-page-agent';

interface UsePageAgentContextFallbackParams {
  contextKey?: string;
  enabled?: boolean;
  fileId: string;
  fileName?: string;
  text: string | null;
}

export const usePageAgentContextFallback = ({
  contextKey,
  enabled,
  fileId,
  fileName,
  text,
}: UsePageAgentContextFallbackParams) => {
  useEffect(() => {
    if (!enabled || !contextKey || text === null) return;

    pageAgentRuntime.setScopedFallbackPageContentContext({
      context: {
        markdown: text,
        metadata: {
          charCount: text.length,
          lineCount: text.split('\n').length,
          title: fileName || 'Untitled',
        },
        xml: '',
      },
      contextKey,
      docId: fileId,
    });

    return () => {
      pageAgentRuntime.setScopedFallbackPageContentContext({ contextKey });
    };
  }, [contextKey, enabled, fileId, fileName, text]);
};
