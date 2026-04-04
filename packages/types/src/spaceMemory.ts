export const spaceMemorySections = ['inbox', 'published', 'playbooks', 'policies'] as const;
export const spaceMemoryCategories = ['general', 'playbook', 'policy'] as const;

export type SpaceMemorySection = (typeof spaceMemorySections)[number];
export type SpaceMemoryCategory = (typeof spaceMemoryCategories)[number];
export type SpaceMemorySourceKind = 'document' | 'file' | 'message' | 'source_set' | 'topic';

export interface SpaceMemorySourceRefPreview {
  id: string;
  kind: SpaceMemorySourceKind;
  title?: string;
}

export interface SpaceMemoryEntryPreview {
  actor?: {
    id?: string | null;
    name?: string | null;
    username?: string | null;
  };
  category: SpaceMemoryCategory;
  id: string;
  kind: 'candidate' | 'memory';
  publishedAt?: string | null;
  sourceCount: number;
  sourceRefs: SpaceMemorySourceRefPreview[];
  summary?: string | null;
  title: string;
  updatedAt: string;
}

export interface SpaceMemorySectionResult {
  items: SpaceMemoryEntryPreview[];
  section: SpaceMemorySection;
}

export interface SpaceMemorySectionSummary {
  count: number;
}

export interface SpaceMemorySummary {
  canCreate: boolean;
  canPublish: boolean;
  canReview: boolean;
  id: string;
  kind?: 'personal' | 'team' | string | null;
  membershipRole?: string | null;
  name?: string | null;
  sections: Record<SpaceMemorySection, SpaceMemorySectionSummary>;
}
