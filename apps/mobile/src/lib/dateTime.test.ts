import { describe, expect, it } from 'vitest';

import { formatMobileDate, formatMobileDateTime } from './dateTime';

describe('formatMobileDate', () => {
  it('formats date as YYYY-MM-DD', () => {
    expect(formatMobileDate('2026-04-06T09:08:07.000Z')).toBe('2026-04-06');
  });

  it('accepts numeric timestamps', () => {
    expect(formatMobileDate(Date.UTC(2026, 3, 6, 9, 8, 7))).toBe('2026-04-06');
  });

  it('returns em dash for invalid values', () => {
    expect(formatMobileDate('invalid')).toBe('—');
    expect(formatMobileDate(null)).toBe('—');
  });
});

describe('formatMobileDateTime', () => {
  it('formats datetime as YYYY-MM-DD HH:mm', () => {
    expect(formatMobileDateTime('2026-04-06T09:08:07.000Z')).toMatch(/2026-04-06 \d{2}:\d{2}/);
  });

  it('accepts numeric timestamps', () => {
    expect(formatMobileDateTime(Date.UTC(2026, 3, 6, 9, 8, 7))).toMatch(
      /2026-04-06 \d{2}:\d{2}/,
    );
  });

  it('returns em dash for invalid values', () => {
    expect(formatMobileDateTime('invalid')).toBe('—');
    expect(formatMobileDateTime(null)).toBe('—');
  });
});
