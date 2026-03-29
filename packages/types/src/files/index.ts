import type { BlobStatus, ContentRole } from '../content';

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
  DocEditor = 'doc-editor',
  ImageGeneration = 'image_generation',
  VideoGeneration = 'video_generation',
}

export interface FileItem {
  blobId?: string | null;
  blobStatus?: BlobStatus | null;
  content?: string;
  contentRole?: ContentRole | null;
  contentUid?: string | null;
  createdAt: Date;
  enabled?: boolean;
  id: string;
  name: string;
  size: number;
  source?: FileSource | null;
  spaceId?: string | null;
  type: string;
  updatedAt: Date;
  url: string;
}

export * from './list';
export * from './upload';
