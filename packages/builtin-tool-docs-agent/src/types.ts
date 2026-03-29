/**
 * Docs Agent / document tool identifier
 */
export const DocsAgentIdentifier = 'lobe-docs-agent';

export const DocApiName = {
  // Initialize
  initDoc: 'initDoc',

  // Document Metadata
  editTitle: 'editTitle',

  // Query & Read
  getDocContent: 'getDocContent',

  // Unified CRUD
  modifyNodes: 'modifyNodes',

  // Text Operations
  replaceText: 'replaceText',
};

// ============ State Types for Renders ============

export interface GetDocContentState {
  documentId: string;
  markdown?: string;
  metadata: {
    fileType?: string;
    title: string;
    totalCharCount?: number;
    totalLineCount?: number;
  };
  xml?: string;
}

export interface ModifyNodesState {
  results: Array<{
    action: 'insert' | 'remove' | 'modify';
    error?: string;
    success: boolean;
  }>;
  successCount: number;
  totalCount: number;
}

export interface ReplaceTextState {
  /** IDs of nodes that were modified */
  modifiedNodeIds: string[];
  /** Number of replacements made */
  replacementCount: number;
}

// ============ Initialize State ============
export interface InitDocState {
  nodeCount: number;
  rootId: string;
}

// ============ Document Metadata State ============
export interface EditTitleState {
  newTitle: string;
  previousTitle: string;
}
