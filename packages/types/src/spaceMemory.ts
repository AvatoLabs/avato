import type { SpaceRole } from './content';

export const spaceMemorySections = ['inbox', 'published', 'playbooks', 'policies'] as const;
export const spaceMemoryCategories = ['general', 'playbook', 'policy'] as const;
export const spaceMemoryIngestOrigins = ['automation', 'harness', 'manual'] as const;
export const spaceMemoryDetailViews = ['audit', 'overview'] as const;
export const spaceMemoryRecallFilters = ['active', 'all', 'disabled', 'expired', 'stale'] as const;
export const SPACE_MEMORY_CREATE_ROLES = ['admin', 'editor', 'owner'] as const satisfies readonly SpaceRole[];
export const SPACE_MEMORY_REVIEW_ROLES = ['admin', 'editor', 'owner'] as const satisfies readonly SpaceRole[];

const SPACE_MEMORY_CREATE_ROLE_SET = new Set<SpaceRole>(SPACE_MEMORY_CREATE_ROLES);
const SPACE_MEMORY_REVIEW_ROLE_SET = new Set<SpaceRole>(SPACE_MEMORY_REVIEW_ROLES);

export type SpaceMemorySection = (typeof spaceMemorySections)[number];
export type SpaceMemoryCategory = (typeof spaceMemoryCategories)[number];
export type SpaceMemoryDetailView = (typeof spaceMemoryDetailViews)[number];
export type SpaceMemoryIngestOrigin = (typeof spaceMemoryIngestOrigins)[number];
export type SpaceMemoryRecallFilter = (typeof spaceMemoryRecallFilters)[number];
export type SpaceMemorySourceKind = 'document' | 'file' | 'message' | 'source_set' | 'topic';
export type SpaceMemorySurface = 'personal' | 'reviewer' | 'viewer';
export type SpaceMemoryHarnessDecision =
  | 'ADD'
  | 'ARCHIVE'
  | 'IGNORE'
  | 'MERGE'
  | 'REVIEW'
  | 'UPDATE';
export type SpaceMemoryHarnessKind =
  | 'context'
  | 'fact'
  | 'persona'
  | 'playbook'
  | 'policy'
  | 'preference';
export type SpaceMemoryHarnessScope = 'agent' | 'space' | 'user';
export type SpaceMemoryHarnessSourceObjectType =
  | 'chat'
  | 'doc'
  | 'document'
  | 'file'
  | 'meeting'
  | 'message'
  | 'source_set'
  | 'task'
  | 'topic';

export interface SpaceMemoryCapabilityTarget {
  kind?: string | null;
  membershipRole?: string | null;
}

export const canCreateSpaceMemory = (space?: SpaceMemoryCapabilityTarget) => {
  if (!space || space.kind !== 'team') return false;

  return SPACE_MEMORY_CREATE_ROLE_SET.has(space.membershipRole as SpaceRole);
};

export const canReviewSpaceMemory = (space?: SpaceMemoryCapabilityTarget) => {
  if (!space || space.kind !== 'team') return false;

  return SPACE_MEMORY_REVIEW_ROLE_SET.has(space.membershipRole as SpaceRole);
};

export const getSpaceMemoryCapabilities = (space?: SpaceMemoryCapabilityTarget) => ({
  canCreate: canCreateSpaceMemory(space),
  canReview: canReviewSpaceMemory(space),
});

export const getSpaceMemorySurface = (space?: SpaceMemoryCapabilityTarget): SpaceMemorySurface => {
  if (!space || space.kind !== 'team') return 'personal';

  return canReviewSpaceMemory(space) ? 'reviewer' : 'viewer';
};

export interface SpaceMemorySurfaceContract {
  canAccessAudit: boolean;
  canManageRecall: boolean;
  canViewInbox: boolean;
  detailViews: SpaceMemoryDetailView[];
  recallFilters: SpaceMemoryRecallFilter[];
  sections: SpaceMemorySection[];
}

export const getSpaceMemorySurfaceContract = (
  surface: SpaceMemorySurface,
): SpaceMemorySurfaceContract => {
  if (surface === 'viewer') {
    return {
      canAccessAudit: false,
      canManageRecall: false,
      canViewInbox: false,
      detailViews: ['overview'],
      recallFilters: ['all'],
      sections: ['published', 'playbooks', 'policies'],
    };
  }

  return {
    canAccessAudit: true,
    canManageRecall: true,
    canViewInbox: true,
    detailViews: [...spaceMemoryDetailViews],
    recallFilters: [...spaceMemoryRecallFilters],
    sections: [...spaceMemorySections],
  };
};

export const canManageSpaceMemoryFromContract = (contract?: SpaceMemorySurfaceContract | null) =>
  Boolean(contract?.canManageRecall);

export interface SpaceMemorySourceRefPreview {
  id: string;
  kind: SpaceMemorySourceKind;
  title?: string;
}

export interface SpaceMemoryHarnessSourceRef {
  objectId: string;
  objectType: SpaceMemoryHarnessSourceObjectType;
  snippet?: string | null;
  title?: string | null;
  version?: string | null;
}

export interface SpaceMemoryHarnessDecisionDraft {
  confidence?: number | null;
  decision: SpaceMemoryHarnessDecision;
  reason: string;
  targetCandidateId?: string | null;
  targetEntryId?: string | null;
}

export interface SpaceMemoryHarnessRecallDraft {
  entryId?: string | null;
  reason: string;
  relevance: number;
  slots?: string[];
}

export interface SpaceMemoryHarnessCandidateDraft {
  category?: SpaceMemoryCategory;
  confidence?: number | null;
  content?: string | null;
  decision?: SpaceMemoryHarnessDecisionDraft | null;
  kind?: SpaceMemoryHarnessKind | null;
  metadata?: Record<string, unknown>;
  normalizedKey?: string | null;
  proposedOwnerId?: string | null;
  proposedReviewerId?: string | null;
  recall?: SpaceMemoryHarnessRecallDraft | null;
  scope?: SpaceMemoryHarnessScope | null;
  sourceRefs: SpaceMemoryHarnessSourceRef[];
  summary?: string | null;
  title: string;
}

export interface SpaceMemoryHarnessIngestPayload {
  adapter?: string;
  drafts: SpaceMemoryHarnessCandidateDraft[];
  producer?: string;
  spaceId: string;
  traceId?: string;
  userId: string;
}

export interface SpaceMemoryCandidateDraft {
  category?: SpaceMemoryCategory;
  content?: string | null;
  metadata?: Record<string, unknown>;
  sourceRefs?: SpaceMemorySourceRefPreview[];
  summary?: string | null;
  title: string;
}

export interface SpaceMemoryIntakePreview {
  origin?: SpaceMemoryIngestOrigin;
  producer?: string | null;
  traceId?: string | null;
}

export interface SpaceMemoryGovernanceHistoryPreview {
  action: 'merged' | 'policy_updated' | 'published';
  actor?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  };
  at: string;
  changes?: {
    content?: { after?: string | null; before?: string | null };
    expiresAt?: { after?: string | null; before?: string | null };
    lastVerifiedAt?: { after?: string | null; before?: string | null };
    recallEnabled?: { after?: boolean | null; before?: boolean | null };
    staleAt?: { after?: string | null; before?: string | null };
    summary?: { after?: string | null; before?: string | null };
    title?: { after?: string | null; before?: string | null };
  };
  resolution?: {
    appendSources?: boolean;
    applyContent?: boolean;
    applySummary?: boolean;
    applyTitle?: boolean;
  };
  sourceTitle?: string | null;
}

export interface SpaceMemoryRecallPolicyPreview {
  expiresAt?: string | null;
  lastVerifiedAt?: string | null;
  recallBlockedReason?: 'disabled' | 'expired' | 'stale';
  recallEnabled: boolean;
  staleAt?: string | null;
}

export interface SpaceMemoryReviewHintPreview {
  kind: 'duplicate_published';
  match: {
    content?: string | null;
    id: string;
    publishedAt?: string | null;
    summary?: string | null;
    title: string;
  };
  mergePreview: {
    addedSourceCount: number;
    updatesContent: boolean;
    updatesSummary: boolean;
    updatesTitle: boolean;
  };
}

export interface SpaceMemoryEntryPreview {
  actor?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  };
  category: SpaceMemoryCategory;
  content?: string | null;
  history?: SpaceMemoryGovernanceHistoryPreview[];
  id: string;
  intake?: SpaceMemoryIntakePreview;
  kind: 'candidate' | 'memory';
  publishedAt?: string | null;
  recall?: SpaceMemoryRecallPolicyPreview;
  reviewHint?: SpaceMemoryReviewHintPreview;
  sourceCount: number;
  sourceRefs: SpaceMemorySourceRefPreview[];
  summary?: string | null;
  title: string;
  updatedAt: string;
}

export interface SpaceMemorySectionResult {
  contract?: SpaceMemorySurfaceContract;
  items: SpaceMemoryEntryPreview[];
  section: SpaceMemorySection;
  surface: SpaceMemorySurface;
}

export interface SpaceMemoryEntryResult {
  contract?: SpaceMemorySurfaceContract;
  entry: SpaceMemoryEntryPreview;
  surface: SpaceMemorySurface;
}

export interface SpaceMemorySectionSummary {
  count: number;
  recall: {
    active: number;
    disabled: number;
    expired: number;
    stale: number;
  };
}

export interface SpaceMemorySummary {
  canCreate: boolean;
  canPublish: boolean;
  canReview: boolean;
  contract?: SpaceMemorySurfaceContract;
  id: string;
  kind?: 'personal' | 'team' | string | null;
  membershipRole?: string | null;
  name?: string | null;
  surface: SpaceMemorySurface;
  sections: Record<SpaceMemorySection, SpaceMemorySectionSummary>;
}

export interface SpaceMemoryAuditBundle {
  auditPath: string;
  detailView: 'audit';
  entry: SpaceMemoryEntryPreview;
  exportedAt: string;
  recallFilter: 'active' | 'all' | 'disabled' | 'expired' | 'stale';
  section: SpaceMemorySection;
  space: {
    id: string;
    kind?: 'personal' | 'team' | string | null;
    membershipRole?: string | null;
    name?: string | null;
  };
}

export interface SpaceMemoryAuditBatchBundle {
  count: number;
  exportedAt: string;
  items: SpaceMemoryAuditBundle[];
  recallFilter: 'active' | 'all' | 'disabled' | 'expired' | 'stale';
  space: {
    id: string;
    kind?: 'personal' | 'team' | string | null;
    membershipRole?: string | null;
    name?: string | null;
  };
}
