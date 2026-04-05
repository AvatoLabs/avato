export enum FileAssetReviewStatus {
  Approved = 'approved',
  Archived = 'archived',
  Draft = 'draft',
}

export enum FileAssetUsagePolicy {
  Internal = 'internal',
  Public = 'public',
  Restricted = 'restricted',
}

export enum FileAssetClassification {
  Brand = 'brand',
  Finance = 'finance',
  General = 'general',
  Hr = 'hr',
  Legal = 'legal',
  Product = 'product',
}

export interface FileAssetMetadata {
  custom?: Record<string, unknown>;
  license?: string;
  tags?: string[];
}

export interface FileAssetItem {
  classification: FileAssetClassification;
  createdAt: Date;
  createdBy?: string | null;
  fileId: string;
  metadata?: FileAssetMetadata | null;
  reviewedAt?: Date | null;
  reviewedBy?: string | null;
  reviewStatus: FileAssetReviewStatus;
  rightsOwner?: string | null;
  spaceId: string;
  updatedAt: Date;
  usagePolicy: FileAssetUsagePolicy;
}

export interface FileAssetCapabilities {
  canApprove: boolean;
  canArchive: boolean;
  canEditGovernance: boolean;
}

export interface FileAssetState {
  capabilities: FileAssetCapabilities;
  item: FileAssetItem | null;
}
