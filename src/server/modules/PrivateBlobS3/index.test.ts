// @vitest-environment node
import { Readable } from 'node:stream';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrivateBlobS3 } from './index';

vi.mock('@aws-sdk/client-s3');
vi.mock('@/envs/file', () => ({
  fileEnv: {
    S3_ACCESS_KEY_ID: 'test-access-key',
    S3_BUCKET: 'test-bucket',
    S3_ENABLE_PATH_STYLE: false,
    S3_ENDPOINT: 'https://s3.amazonaws.com',
    S3_PREVIEW_URL_EXPIRE_IN: 7200,
    S3_REGION: 'us-east-1',
    S3_SECRET_ACCESS_KEY: 'test-secret-key',
    S3_SET_ACL: false,
  },
}));

describe('PrivateBlobS3', () => {
  let mockS3ClientSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3ClientSend = vi.fn().mockResolvedValue({});

    (S3Client as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      send: mockS3ClientSend,
    }));
  });

  it('should include ContentLength when uploading a stream body', async () => {
    const s3 = new PrivateBlobS3();
    const body = Readable.from(Buffer.from('hello'));

    await s3.uploadBody('uploads/test.txt', body, {
      contentLength: 5,
      contentType: 'text/plain',
    });

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Body: body,
        Bucket: 'test-bucket',
        ContentLength: 5,
        ContentType: 'text/plain',
        Key: 'uploads/test.txt',
      }),
    );
  });

  it('should reject stream bodies that do not declare ContentLength', async () => {
    const s3 = new PrivateBlobS3();

    await expect(
      s3.uploadBody('uploads/test.txt', Readable.from(Buffer.from('hello')), {
        contentType: 'text/plain',
      }),
    ).rejects.toThrow('ContentLength is required when uploading a stream body to S3.');

    expect(mockS3ClientSend).not.toHaveBeenCalled();
  });

  it('should set ContentLength automatically for buffer uploads', async () => {
    const s3 = new PrivateBlobS3();
    const buffer = Buffer.from('hello');

    await s3.uploadBuffer('uploads/test.txt', buffer, 'text/plain');

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Body: buffer,
        Bucket: 'test-bucket',
        ContentLength: buffer.length,
        ContentType: 'text/plain',
        Key: 'uploads/test.txt',
      }),
    );
  });
});
