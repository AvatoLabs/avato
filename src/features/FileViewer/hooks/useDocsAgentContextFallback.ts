'use client';

import { useEffect } from 'react';

import { docsAgentRuntime } from '@/store/tool/slices/builtin/executors/lobe-docs-agent';

interface UseDocsAgentContextFallbackParams {
  contextKey?: string;
  enabled?: boolean;
  fileId: string;
  fileName?: string;
  text: string | null;
}

export const useDocsAgentContextFallback = ({
  contextKey,
  enabled,
  fileId,
  fileName,
  text,
}: UseDocsAgentContextFallbackParams) => {
  useEffect(() => {
    if (!enabled || !contextKey || text === null) return;

    docsAgentRuntime.setScopedFallbackDocContentContext({
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
      docsAgentRuntime.setScopedFallbackDocContentContext({ contextKey });
    };
  }, [contextKey, enabled, fileId, fileName, text]);
};
