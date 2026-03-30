import { z } from 'zod';

/**
 * Doc selection represents a user-selected text region in a document.
 * Used for Ask AI functionality to persist selection context with user messages.
 */
export interface DocSelection {
  anchor?: {
    startNodeId: string;
    endNodeId: string;
    startOffset: number;
    endOffset: number;
  };
  /** Selected content (plain text or markdown) */
  content: string;
  /** Doc ID the selection belongs to */
  docId: string;
  /** End line number */
  endLine?: number;
  /** Selection unique identifier */
  id: string;
  /** Start line number */
  startLine?: number;
  /** XML structure of the selected content (for positioning edits) */
  xml?: string;
}

export const DocSelectionSchema = z.object({
  id: z.string(),
  content: z.string(),
  xml: z.string().optional(),
  docId: z.string(),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
});
