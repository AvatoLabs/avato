export enum SkillAggregatorSource {
  SkillHub = 'skillhub',
}

export enum SkillAggregatorSorts {
  Downloads = 'downloads',
  InstallCount = 'installCount',
  Name = 'name',
  Relevance = 'relevance',
  Stars = 'stars',
  UpdatedAt = 'updatedAt',
}

export const SKILL_AGGREGATOR_ALL_SOURCE = 'all';

export type SkillAggregatorSourceFilter =
  | SkillAggregatorSource
  | typeof SKILL_AGGREGATOR_ALL_SOURCE;

export interface SkillAggregatorSourceLink {
  source: SkillAggregatorSource;
  url: string;
}

export enum SkillAggregatorInstallabilityLevel {
  Discoverable = 'discoverable',
  Importable = 'importable',
  Installable = 'installable',
  Verified = 'verified',
}

export enum SkillAggregatorInstallabilityReason {
  DownloadUnavailable = 'downloadUnavailable',
  FetchFailed = 'fetchFailed',
  InvalidPackage = 'invalidPackage',
  PackageTooLarge = 'packageTooLarge',
}

export interface SkillAggregatorInstallability {
  level: SkillAggregatorInstallabilityLevel;
  reason?: SkillAggregatorInstallabilityReason;
  validatedAt?: string;
}

export const isSkillAggregatorInstallable = (
  installability: SkillAggregatorInstallability,
): boolean =>
  [
    SkillAggregatorInstallabilityLevel.Installable,
    SkillAggregatorInstallabilityLevel.Verified,
  ].includes(installability.level);

export interface SkillAggregatorItem {
  category?: string;
  description: string;
  downloadCount?: number;
  homepage?: string;
  id: string;
  identifier: string;
  importIdentifier: string;
  importUrl?: string;
  installability: SkillAggregatorInstallability;
  installCount?: number;
  ownerName?: string;
  slug: string;
  sourceLinks: SkillAggregatorSourceLink[];
  sources: SkillAggregatorSource[];
  starCount?: number;
  tags: string[];
  title: string;
  updatedAt?: string;
  version?: string;
}

export interface SkillAggregatorCollection {
  allCount: number;
  fetchedAt: string;
  items: SkillAggregatorItem[];
  sourceCounts: Array<{
    count: number;
    source: SkillAggregatorSource;
  }>;
  stats: {
    curatedCount: number;
    verifiedCount: number;
  };
  warnings: Array<{
    message: string;
    source: SkillAggregatorSource;
  }>;
}

export interface SkillAggregatorListResponse extends SkillAggregatorCollection {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

export interface SkillAggregatorQueryParams {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: SkillAggregatorSorts;
  source?: SkillAggregatorSourceFilter;
}
