import type { McpInstallSchema } from '@lobechat/electron-client-ipc';

export enum AggregatorSource {
  Glama = 'glama',
  Higress = 'higress',
  Official = 'official',
  Smithery = 'smithery',
}

export enum AggregatorKind {
  Mcp = 'mcp',
  Skills = 'skills',
}

export enum AggregatorSorts {
  Name = 'name',
  Popularity = 'popularity',
  Relevance = 'relevance',
  UpdatedAt = 'updatedAt',
}

export const AGGREGATOR_ALL_SOURCE = 'all';

export type AggregatorSourceFilter = AggregatorSource | typeof AGGREGATOR_ALL_SOURCE;

export interface AggregatorSourceLink {
  source: AggregatorSource;
  url: string;
}

export enum AggregatorInstallabilityLevel {
  Discoverable = 'discoverable',
  Installable = 'installable',
  Verified = 'verified',
}

export enum AggregatorInstallabilityReason {
  ConfigRequired = 'configRequired',
  MissingConnection = 'missingConnection',
  NotRemote = 'notRemote',
  VerificationFailed = 'verificationFailed',
}

export interface AggregatorInstallability {
  installSchema?: McpInstallSchema;
  level: AggregatorInstallabilityLevel;
  reason?: AggregatorInstallabilityReason;
  validatedAt?: string;
}

export const isAggregatorInstallable = (installability: AggregatorInstallability): boolean =>
  [AggregatorInstallabilityLevel.Installable, AggregatorInstallabilityLevel.Verified].includes(
    installability.level,
  );

export interface AggregatorItem {
  badges: string[];
  createdAt?: string;
  description: string;
  homepage?: string;
  icon?: string;
  id: string;
  identifier: string;
  installability: AggregatorInstallability;
  installCount?: number;
  isOfficial: boolean;
  isRemote: boolean;
  isVerified: boolean;
  popularity: number;
  repositoryUrl?: string;
  score: number;
  sourceLinks: AggregatorSourceLink[];
  sources: AggregatorSource[];
  starCount?: number;
  title: string;
  toolCount?: number;
  transportTypes: string[];
  updatedAt?: string;
}

export interface AggregatorCollection {
  allCount: number;
  fetchedAt: string;
  items: AggregatorItem[];
  sourceCounts: Array<{
    count: number;
    source: AggregatorSource;
  }>;
  warnings: Array<{
    message: string;
    source: AggregatorSource;
  }>;
}

export interface AggregatorListResponse extends AggregatorCollection {
  currentPage: number;
  pageSize: number;
  stats: {
    installableCount: number;
    officialCount: number;
    remoteCount: number;
    verifiedCount: number;
  };
  totalCount: number;
  totalPages: number;
}

export interface AggregatorQueryParams {
  installable?: boolean;
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: AggregatorSorts;
  source?: AggregatorSourceFilter;
}
