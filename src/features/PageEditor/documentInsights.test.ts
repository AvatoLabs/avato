import { describe, expect, it } from 'vitest';

import {
  countDocumentWords,
  estimateReadingMinutes,
  extractDocumentOutline,
  normalizeHeadingText,
} from './documentInsights';

describe('documentInsights', () => {
  it('counts latin words and CJK characters together', () => {
    expect(countDocumentWords('Hello world 你好')).toBe(4);
  });

  it('estimates reading time with a minimum of one minute', () => {
    expect(estimateReadingMinutes(0)).toBe(0);
    expect(estimateReadingMinutes(10)).toBe(1);
    expect(estimateReadingMinutes(520)).toBe(2);
  });

  it('extracts markdown headings in order', () => {
    expect(
      extractDocumentOutline(`# Title

Intro

## Section One
### Section Two`),
    ).toEqual([
      { id: 'title', level: 1, text: 'Title' },
      { id: 'section-one', level: 2, text: 'Section One' },
      { id: 'section-two', level: 3, text: 'Section Two' },
    ]);
  });

  it('normalizes heading text for matching editor content', () => {
    expect(normalizeHeadingText('## [Hello](https://example.com)  World')).toBe('hello world');
  });
});
