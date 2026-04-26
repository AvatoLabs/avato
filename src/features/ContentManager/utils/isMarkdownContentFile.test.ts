import { describe, expect, it } from 'vitest';

import { isMarkdownContentFile } from './isMarkdownContentFile';

describe('isMarkdownContentFile', () => {
  it('matches markdown file extensions', () => {
    expect(isMarkdownContentFile('README.md', 'text/plain')).toBe(true);
    expect(isMarkdownContentFile('guide.markdown', undefined)).toBe(true);
  });

  it('matches markdown mime types and aliases', () => {
    expect(isMarkdownContentFile('notes.txt', 'text/markdown')).toBe(true);
    expect(isMarkdownContentFile('notes.txt', 'markdown')).toBe(true);
    expect(isMarkdownContentFile('notes.txt', 'application/markdown')).toBe(true);
  });

  it('ignores non-markdown files', () => {
    expect(isMarkdownContentFile('notes.txt', 'text/plain')).toBe(false);
    expect(isMarkdownContentFile('diagram.mmd', 'text/vnd.mermaid')).toBe(false);
  });
});
