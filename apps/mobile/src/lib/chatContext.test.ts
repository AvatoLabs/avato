import { describe, expect, it, vi } from 'vitest';

import {
  buildDocContextDisplayText,
  buildDocContextPromptText,
  isChatContextEligibleResource,
  toDocSelections,
} from './chatContext';

vi.mock('./api', () => ({
  fileApi: {},
  resourceApi: {},
}));

describe('chatContext helpers', () => {
  it('treats canonical documents and markdown files as chat-context eligible', () => {
    expect(
      isChatContextEligibleResource({
        fileType: 'custom/page',
        id: 'docs_123',
        name: 'Product Spec',
        sourceType: 'document',
      }),
    ).toBe(true);

    expect(
      isChatContextEligibleResource({
        fileType: 'application/pdf',
        id: 'docs_derived_1',
        name: 'Spec.pdf',
        sourceType: 'file',
      }),
    ).toBe(true);

    expect(
      isChatContextEligibleResource({
        fileType: 'text/markdown',
        id: 'file_123',
        name: 'notes.md',
        sourceType: 'file',
      }),
    ).toBe(true);

    expect(
      isChatContextEligibleResource({
        fileType: 'application/pdf',
        id: 'file_456',
        name: 'deck.pdf',
        sourceType: 'file',
      }),
    ).toBe(false);
  });

  it('converts context selections into doc selections and prompt/display text', () => {
    const contexts = [
      {
        content: 'Alpha content',
        docId: 'docs_alpha',
        id: 'document-context-docs_alpha',
        preview: 'Alpha',
        title: 'Alpha',
        type: 'text' as const,
      },
      {
        content: 'Beta content',
        docId: 'docs_beta',
        id: 'document-context-docs_beta',
        preview: 'Beta',
        title: 'Beta',
        type: 'text' as const,
      },
    ];

    expect(toDocSelections(contexts)).toEqual([
      {
        content: 'Alpha content',
        docId: 'docs_alpha',
        id: 'document-context-docs_alpha',
        xml: 'Alpha content',
      },
      {
        content: 'Beta content',
        docId: 'docs_beta',
        id: 'document-context-docs_beta',
        xml: 'Beta content',
      },
    ]);

    expect(buildDocContextDisplayText(contexts)).toBe('- Alpha\n- Beta');
    expect(buildDocContextPromptText(contexts)).toContain('- Alpha:\nAlpha content');
    expect(buildDocContextPromptText(contexts)).toContain('- Beta:\nBeta content');
  });
});
