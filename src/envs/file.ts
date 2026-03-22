import { createEnv } from '@t3-oss/env-core';
import { z } from 'zod';

const DEFAULT_S3_FILE_PATH = 'files';

export const getFileConfig = () => {
  return createEnv({
    clientPrefix: 'NEXT_PUBLIC_',
    client: {
      NEXT_PUBLIC_S3_FILE_PATH: z.string().optional(),
    },
    runtimeEnv: {
      CHUNKS_AUTO_EMBEDDING: process.env.CHUNKS_AUTO_EMBEDDING !== '0',
      CHUNKS_AUTO_GEN_METADATA: process.env.CHUNKS_AUTO_GEN_METADATA !== '0',
      EMBEDDING_BATCH_SIZE: process.env.EMBEDDING_BATCH_SIZE,
      EMBEDDING_CONCURRENCY: process.env.EMBEDDING_CONCURRENCY,

      NEXT_PUBLIC_S3_FILE_PATH: process.env.NEXT_PUBLIC_S3_FILE_PATH || DEFAULT_S3_FILE_PATH,

      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
      S3_BUCKET: process.env.S3_BUCKET,
      S3_ENABLE_PATH_STYLE: process.env.S3_ENABLE_PATH_STYLE === '1',
      S3_ENDPOINT: process.env.S3_ENDPOINT,
      S3_PREVIEW_URL_EXPIRE_IN: parseInt(process.env.S3_PREVIEW_URL_EXPIRE_IN || '7200'),
      S3_PUBLIC_DOMAIN: process.env.S3_PUBLIC_DOMAIN,
      S3_REGION: process.env.S3_REGION,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
      // App bucket PutObject does not set object ACL. Opt-in only (`S3_SET_ACL=1`) for legacy tooling that
      // reads this flag; default false avoids implying public-read if code paths consult it again.
      S3_SET_ACL: process.env.S3_SET_ACL === '1',
    },
    server: {
      CHUNKS_AUTO_EMBEDDING: z.boolean(),
      CHUNKS_AUTO_GEN_METADATA: z.boolean(),
      EMBEDDING_BATCH_SIZE: z.coerce.number().int().positive().default(50),
      EMBEDDING_CONCURRENCY: z.coerce.number().int().positive().default(10),

      // S3
      S3_ACCESS_KEY_ID: z.string().optional(),
      S3_BUCKET: z.string().optional(),
      S3_ENABLE_PATH_STYLE: z.boolean(),

      S3_ENDPOINT: z.string().url().optional(),
      S3_PREVIEW_URL_EXPIRE_IN: z.number(),
      S3_PUBLIC_DOMAIN: z.string().optional(),
      S3_REGION: z.string().optional(),
      S3_SECRET_ACCESS_KEY: z.string().optional(),
      S3_SET_ACL: z.boolean(),
    },
  });
};

export const fileEnv = getFileConfig();
