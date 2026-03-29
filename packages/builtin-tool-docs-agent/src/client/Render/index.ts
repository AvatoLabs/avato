import { DocApiName } from '../../types';

/**
 * Docs Agent render component registry
 *
 * Render components customize how tool results are displayed to users.
 */
export const DocsAgentRenders: Record<string, null> = {
  [DocApiName.initDoc]: null,
};
