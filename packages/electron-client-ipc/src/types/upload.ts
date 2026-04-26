export interface UploadFileParams {
  content: ArrayBuffer;
  filename: string;
  sha256: string;
  path: string;
  type: string;
}

export interface FileMetadata {
  date: string;
  dirname: string;
  filename: string;
  path: string;
}
