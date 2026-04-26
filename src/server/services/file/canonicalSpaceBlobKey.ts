const CANONICAL_SPACE_BLOB_KEY_PATTERN = /^v2\/spaces\/[^/]+\/blobs\/.+/;

export const isCanonicalSpaceBlobKey = (value?: string | null) =>
  !!value && CANONICAL_SPACE_BLOB_KEY_PATTERN.test(value.trim());
