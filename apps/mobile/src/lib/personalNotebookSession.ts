/**
 * Standalone Notebook (Profile → Notebook) uses an agent-bound session on the server.
 * We tag it with a fixed slug and hide it from the Chats list / directory so it does
 * not look like a spawned assistant.
 */
export const PERSONAL_NOTEBOOK_STANDALONE_SLUG = 'lobe-mobile-personal-notebook';

/** Persisted when the personal notebook session is created or resolved (legacy without slug). */
export const PERSONAL_NOTEBOOK_SESSION_STORAGE_KEY = 'avato_personal_notebook_session_id';

export function shouldHidePersonalNotebookSession(
  session: { id: string; slug?: string | null | undefined },
  storedHiddenSessionId: string | null | undefined,
): boolean {
  if (session.slug === PERSONAL_NOTEBOOK_STANDALONE_SLUG) return true;
  if (storedHiddenSessionId && session.id === storedHiddenSessionId) return true;
  return false;
}
