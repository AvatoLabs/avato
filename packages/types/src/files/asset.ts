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

export enum FileAssetRenditionKind {
  Caption = 'caption',
  Embedding = 'embedding',
  Preview = 'preview',
  Print = 'print',
  Thumbnail = 'thumbnail',
  Transcript = 'transcript',
  Web = 'web',
}

export interface FileAssetVersionInfo {
  label?: string;
  variantOf?: string;
}

export interface FileAssetRenditionInfo {
  kind: FileAssetRenditionKind;
  label?: string;
}

export interface FileAssetMetadata {
  [key: string]: unknown;
  custom?: Record<string, unknown>;
  license?: string;
  renditions?: FileAssetRenditionInfo[];
  tags?: string[];
  version?: FileAssetVersionInfo | null;
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

export interface FileAssetGovernanceAuditSnapshot {
  classification: FileAssetClassification;
  metadata: FileAssetMetadata | null;
  reviewStatus: FileAssetReviewStatus;
  rightsOwner: string | null;
  usagePolicy: FileAssetUsagePolicy;
}

export interface FileAssetGovernanceAuditItem {
  action: string;
  after?: Partial<FileAssetGovernanceAuditSnapshot> | null;
  actorDisplayName?: string | null;
  actorId?: string | null;
  before?: Partial<FileAssetGovernanceAuditSnapshot> | null;
  changedFields: string[];
  createdAt: Date;
}

export interface FileAssetGovernanceAuditTrailResult {
  hasMore: boolean;
  items: FileAssetGovernanceAuditItem[];
}

export interface FileAssetState {
  capabilities: FileAssetCapabilities;
  governanceAuditTrail?: FileAssetGovernanceAuditItem[];
  governanceAuditTrailHasMore?: boolean;
  item: FileAssetItem | null;
  latestGovernanceAudit?: FileAssetGovernanceAuditItem | null;
}

const FILE_ASSET_RENDITION_KIND_SET = new Set<string>(Object.values(FileAssetRenditionKind));
const FILE_ASSET_TYPED_METADATA_KEYS = new Set([
  'custom',
  'license',
  'renditions',
  'tags',
  'version',
]);

const normalizeOptionalString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeOptionalStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return undefined;

  const normalized = [...new Set(value.map(normalizeOptionalString).filter(Boolean))] as string[];

  return normalized.length > 0 ? normalized : undefined;
};

const normalizeRendition = (value: unknown): FileAssetRenditionInfo | undefined => {
  if (typeof value === 'string' && FILE_ASSET_RENDITION_KIND_SET.has(value)) {
    return { kind: value as FileAssetRenditionKind };
  }

  if (!value || typeof value !== 'object') return undefined;

  const kind = normalizeOptionalString((value as FileAssetRenditionInfo).kind);
  if (!kind || !FILE_ASSET_RENDITION_KIND_SET.has(kind)) return undefined;

  const label = normalizeOptionalString((value as FileAssetRenditionInfo).label);

  return {
    ...(label ? { label } : {}),
    kind: kind as FileAssetRenditionKind,
  };
};

export const pickLegacyFileAssetMetadata = (
  value?: FileAssetMetadata | null,
): Record<string, unknown> | undefined => {
  if (!value || typeof value !== 'object') return undefined;

  const legacyEntries = Object.entries(value).filter(
    ([key, entry]) => !FILE_ASSET_TYPED_METADATA_KEYS.has(key) && entry !== undefined,
  );

  return legacyEntries.length > 0 ? Object.fromEntries(legacyEntries) : undefined;
};

export const normalizeFileAssetMetadata = (
  value?: FileAssetMetadata | null,
): FileAssetMetadata | null => {
  if (!value || typeof value !== 'object') return null;

  const legacy = pickLegacyFileAssetMetadata(value);
  const custom =
    value.custom && typeof value.custom === 'object' && !Array.isArray(value.custom)
      ? value.custom
      : undefined;
  const license = normalizeOptionalString(value.license);
  const tags = normalizeOptionalStringArray(value.tags);
  const renditions = Array.isArray(value.renditions)
    ? (value.renditions.map(normalizeRendition).filter(Boolean) as FileAssetRenditionInfo[])
    : undefined;

  const versionLabel = normalizeOptionalString(value.version?.label);
  const versionVariantOf = normalizeOptionalString(value.version?.variantOf);
  const version =
    versionLabel || versionVariantOf
      ? {
          ...(versionLabel ? { label: versionLabel } : {}),
          ...(versionVariantOf ? { variantOf: versionVariantOf } : {}),
        }
      : undefined;

  const normalized = {
    ...legacy,
    ...(custom ? { custom } : {}),
    ...(license ? { license } : {}),
    ...(renditions && renditions.length > 0 ? { renditions } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(version ? { version } : {}),
  } satisfies FileAssetMetadata;

  return Object.keys(normalized).length > 0 ? normalized : null;
};
