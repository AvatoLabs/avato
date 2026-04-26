/**
 * @vitest-environment happy-dom
 */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { docsAgentRuntime } from '@/store/tool/slices/builtin/executors/lobe-docs-agent';

import { useDocsAgentContextFallback } from './useDocsAgentContextFallback';

const TestComponent = (props: Parameters<typeof useDocsAgentContextFallback>[0]) => {
  useDocsAgentContextFallback(props);
  return null;
};

describe('useDocsAgentContextFallback', () => {
  it('syncs file content into page agent runtime and clears on unmount', () => {
    const setScopedFallbackDocContentContext = vi.spyOn(
      docsAgentRuntime,
      'setScopedFallbackDocContentContext',
    );

    const { unmount } = render(
      <TestComponent
        enabled
        contextKey="page_agent-1_topic-1"
        fileId="file-1"
        fileName="The Pragmatic Pivot.md"
        text={'# Title\n\nBody copy'}
      />,
    );

    expect(setScopedFallbackDocContentContext).toHaveBeenCalledWith({
      context: {
        markdown: '# Title\n\nBody copy',
        metadata: {
          charCount: 18,
          lineCount: 3,
          title: 'The Pragmatic Pivot.md',
        },
        xml: '',
      },
      contextKey: 'page_agent-1_topic-1',
      docId: 'file-1',
    });

    unmount();

    expect(setScopedFallbackDocContentContext).toHaveBeenLastCalledWith({
      contextKey: 'page_agent-1_topic-1',
    });
  });
});
