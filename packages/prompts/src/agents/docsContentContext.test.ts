import { describe, expect, it } from 'vitest';

import { formatDocContentContext } from './docsContentContext';

describe('formatDocContentContext', () => {
  it('should format context with only title', () => {
    const result = formatDocContentContext({
      metadata: { title: 'Test Document' },
    });

    expect(result).toMatchSnapshot();
  });

  it('should format context with markdown content', () => {
    const result = formatDocContentContext({
      markdown: '# Hello\n\nThis is a test.',
      metadata: { title: 'Test Document' },
    });

    expect(result).toMatchSnapshot();
  });

  it('should format context with xml structure', () => {
    const result = formatDocContentContext({
      metadata: { title: 'Test Document' },
      xml: '<root><p id="1">Hello</p></root>',
    });

    expect(result).toMatchSnapshot();
  });

  it('should format context with both markdown and xml', () => {
    const result = formatDocContentContext({
      markdown: '# Hello\n\nWorld',
      metadata: { title: 'Test Document' },
      xml: '<root><h1 id="1">Hello</h1><p id="2">World</p></root>',
    });

    expect(result).toMatchSnapshot();
  });

  it('should use provided charCount and lineCount from metadata', () => {
    const result = formatDocContentContext({
      markdown: '# Test',
      metadata: {
        charCount: 100,
        lineCount: 10,
        title: 'Test Document',
      },
    });

    expect(result).toMatchSnapshot();
  });
});
