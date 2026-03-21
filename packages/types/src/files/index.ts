import type { BlobStatus, ResourceRole } from '../resource';

export enum FilesTabs {
  All = 'all',
  Audios = 'audios',
  Documents = 'documents',
  Home = 'home',
  Images = 'images',
  Pages = 'pages',
  Videos = 'videos',
  Websites = 'websites',
}

export enum FileSource {
  ImageGeneration = 'image_generation',
  PageEditor = 'page-editor',
  VideoGeneration = 'video_generation',
}

export interface FileItem {
  blobId?: string | null;
  blobStatus?: BlobStatus | null;
  content?: string;
  createdAt: Date;
  enabled?: boolean;
  id: string;
  name: string;
  resourceRole?: ResourceRole | null;
  resourceUid?: string | null;
  size: number;
  source?: FileSource | null;
  spaceId?: string | null;
  type: string;
  updatedAt: Date;
  url: string;
}

export * from './list';
export * from './upload';
