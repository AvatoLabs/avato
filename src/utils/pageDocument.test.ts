import { describe, expect, it } from 'vitest';

import { isPageEntryFileType } from './docsDocument';

describe('isPageEntryFileType', () => {
  it('accepts native page document file types', () => {
    expect(isPageEntryFileType('custom/document')).toBe(true);
    expect(isPageEntryFileType('application/pdf')).toBe(true);
  });

  it('accepts notebook document file types', () => {
    expect(isPageEntryFileType('article')).toBe(true);
    expect(isPageEntryFileType('markdown')).toBe(true);
    expect(isPageEntryFileType('note')).toBe(true);
    expect(isPageEntryFileType('report')).toBe(true);
  });

  it('rejects unsupported document file types', () => {
    expect(isPageEntryFileType('agent/plan')).toBe(false);
    expect(isPageEntryFileType('custom/folder')).toBe(false);
    expect(isPageEntryFileType(undefined)).toBe(false);
    expect(isPageEntryFileType(null)).toBe(false);
  });
});
