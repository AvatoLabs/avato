import { describe, expect, it } from 'vitest';

import {
  PERSONAL_NOTEBOOK_STANDALONE_SLUG,
  shouldHidePersonalNotebookSession,
} from './personalNotebookSession';

describe('shouldHidePersonalNotebookSession', () => {
  it('hides by slug', () => {
    expect(
      shouldHidePersonalNotebookSession(
        { id: 'ssn_1', slug: PERSONAL_NOTEBOOK_STANDALONE_SLUG },
        null,
      ),
    ).toBe(true);
  });

  it('hides by stored session id (legacy)', () => {
    expect(shouldHidePersonalNotebookSession({ id: 'ssn_legacy', slug: null }, 'ssn_legacy')).toBe(
      true,
    );
  });

  it('does not hide normal sessions', () => {
    expect(shouldHidePersonalNotebookSession({ id: 'ssn_x', slug: 'other-slug' }, null)).toBe(false);
    expect(shouldHidePersonalNotebookSession({ id: 'ssn_x' }, 'other')).toBe(false);
  });
});
