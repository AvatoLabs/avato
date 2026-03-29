export interface TreeItem {
  children?: TreeItem[];
  fileId?: string | null;
  fileType: string;
  id: string;
  isFolder: boolean;
  metadata?: Record<string, any>;
  name: string;
  slug?: string | null;
  sourceType?: string;
  url: string;
}
