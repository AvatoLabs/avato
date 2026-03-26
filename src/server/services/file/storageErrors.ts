export const STORAGE_OBJECT_MISSING_MESSAGE =
  'File object is missing in storage. Please upload it again.';

export const isStorageObjectMissingError = (error: unknown): boolean => {
  const e = error as {
    $metadata?: { httpStatusCode?: number };
    Code?: string;
    code?: string;
    name?: string;
  };
  const code = e?.Code || e?.code || e?.name;

  return code === 'NoSuchKey' || code === 'NotFound' || e?.$metadata?.httpStatusCode === 404;
};
