import { describe, expect, it } from 'vitest';

import { isMarkdownResource } from './isMarkdownResource';

describe('isMarkdownResource', () => {
  it('matches markdown file extensions', () => {
    expect(isMarkdownResource('README.md', 'text/plain')).toBe(true);
    expect(isMarkdownResource('guide.markdown', undefined)).toBe(true);
  });

  it('matches markdown mime types and aliases', () => {
    expect(isMarkdownResource('notes.txt', 'text/markdown')).toBe(true);
    expect(isMarkdownResource('notes.txt', 'markdown')).toBe(true);
    expect(isMarkdownResource('notes.txt', 'application/markdown')).toBe(true);
  });

  it('ignores non-markdown files', () => {
    expect(isMarkdownResource('notes.txt', 'text/plain')).toBe(false);
    expect(isMarkdownResource('diagram.mmd', 'text/vnd.mermaid')).toBe(false);
  });
});
