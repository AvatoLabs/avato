// @vitest-environment node
import {
  FileAssetClassification,
  FileAssetRenditionKind,
  FileAssetReviewStatus,
  FileAssetUsagePolicy,
} from '@lobechat/types';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { fileAssets, files, globalFiles, spaces, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { FileAssetModel } from '../fileAsset';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'file-asset-model-user-id';
const anotherUserId = 'file-asset-model-user-2';
const spaceId = 'spc_file_asset';
const fileId = 'file_asset_1';
const fileAssetModel = new FileAssetModel(serverDB);

beforeEach(async () => {
  await serverDB.delete(fileAssets);
  await serverDB.delete(files);
  await serverDB.delete(globalFiles);
  await serverDB.delete(spaces);
  await serverDB.delete(users);

  await serverDB.insert(users).values([{ id: userId }, { id: anotherUserId }]);
  await serverDB
    .insert(spaces)
    .values([{ createdBy: userId, id: spaceId, kind: 'team', name: 'Asset Space' }]);
  await serverDB.insert(globalFiles).values({
    creator: userId,
    fileType: 'text/plain',
    hashId: 'hash_asset_1',
    size: 128,
    url: 'https://example.com/asset.txt',
  });
  await serverDB.insert(files).values({
    fileHash: 'hash_asset_1',
    fileType: 'text/plain',
    id: fileId,
    name: 'asset.txt',
    size: 128,
    spaceId,
    url: 'https://example.com/asset.txt',
    userId,
  });
});

afterEach(async () => {
  await serverDB.delete(fileAssets);
  await serverDB.delete(files);
  await serverDB.delete(globalFiles);
  await serverDB.delete(spaces);
  await serverDB.delete(users);
});

describe('FileAssetModel', () => {
  describe('upsert', () => {
    it('should create a file asset sidecar', async () => {
      const item = await fileAssetModel.upsert({
        createdBy: userId,
        fileId,
        metadata: { license: 'CC-BY', tags: ['brand', 'approved'] },
        rightsOwner: 'Design Team',
        spaceId,
      });

      expect(item).toMatchObject({
        classification: FileAssetClassification.General,
        createdBy: userId,
        fileId,
        reviewStatus: FileAssetReviewStatus.Draft,
        rightsOwner: 'Design Team',
        spaceId,
        usagePolicy: FileAssetUsagePolicy.Internal,
      });
      expect(item.metadata).toEqual({ license: 'CC-BY', tags: ['brand', 'approved'] });

      const stored = await serverDB.query.fileAssets.findFirst({
        where: eq(fileAssets.fileId, fileId),
      });
      expect(stored).toMatchObject({
        classification: FileAssetClassification.General,
        createdBy: userId,
        fileId,
        reviewStatus: FileAssetReviewStatus.Draft,
        spaceId,
      });
    });

    it('should update an existing file asset sidecar on conflict', async () => {
      await fileAssetModel.upsert({
        createdBy: userId,
        fileId,
        reviewStatus: FileAssetReviewStatus.Draft,
        spaceId,
      });

      const updated = await fileAssetModel.upsert({
        createdBy: userId,
        classification: FileAssetClassification.Brand,
        fileId,
        metadata: { custom: { campaign: 'spring' } },
        reviewedAt: new Date('2026-04-04T00:00:00.000Z'),
        reviewedBy: anotherUserId,
        reviewStatus: FileAssetReviewStatus.Approved,
        rightsOwner: 'Marketing',
        spaceId,
        usagePolicy: FileAssetUsagePolicy.Restricted,
      });

      expect(updated).toMatchObject({
        classification: FileAssetClassification.Brand,
        createdBy: userId,
        fileId,
        reviewStatus: FileAssetReviewStatus.Approved,
        reviewedBy: anotherUserId,
        rightsOwner: 'Marketing',
        usagePolicy: FileAssetUsagePolicy.Restricted,
      });
      expect(updated.metadata).toEqual({ custom: { campaign: 'spring' } });
    });

    it('should preserve review state when updating a different field', async () => {
      await fileAssetModel.upsert({
        createdBy: userId,
        fileId,
        reviewedAt: new Date('2026-04-04T00:00:00.000Z'),
        reviewedBy: anotherUserId,
        reviewStatus: FileAssetReviewStatus.Approved,
        spaceId,
      });

      const updated = await fileAssetModel.upsert({
        createdBy: userId,
        fileId,
        classification: FileAssetClassification.Legal,
        rightsOwner: 'Legal',
        spaceId,
      });

      expect(updated).toMatchObject({
        classification: FileAssetClassification.Legal,
        fileId,
        reviewedBy: anotherUserId,
        reviewStatus: FileAssetReviewStatus.Approved,
        rightsOwner: 'Legal',
      });
      expect(updated.reviewedAt).toBeTruthy();
    });

    it('should normalize version and rendition metadata on write', async () => {
      const item = await fileAssetModel.upsert({
        createdBy: userId,
        fileId,
        metadata: {
          legacySource: 'brand-portal',
          license: '  CC-BY  ',
          nestedLegacy: { keep: true },
          renditions: [
            { kind: FileAssetRenditionKind.Preview, label: ' Preview ' },
            FileAssetRenditionKind.Web,
            'invalid' as FileAssetRenditionKind,
          ],
          tags: [' brand ', 'brand', 'approved'],
          version: { label: ' v2 ', variantOf: ' Brand System 2026 ' },
        },
        spaceId,
      });

      expect(item.metadata).toEqual({
        legacySource: 'brand-portal',
        license: 'CC-BY',
        nestedLegacy: { keep: true },
        renditions: [
          { kind: FileAssetRenditionKind.Preview, label: 'Preview' },
          { kind: FileAssetRenditionKind.Web },
        ],
        tags: ['brand', 'approved'],
        version: { label: 'v2', variantOf: 'Brand System 2026' },
      });
    });
  });

  describe('findByFileId', () => {
    it('should return undefined when sidecar is missing', async () => {
      await expect(fileAssetModel.findByFileId('missing')).resolves.toBeUndefined();
    });

    it('should find a file asset sidecar by fileId', async () => {
      await fileAssetModel.upsert({
        createdBy: userId,
        classification: FileAssetClassification.Product,
        fileId,
        reviewStatus: FileAssetReviewStatus.Archived,
        spaceId,
        usagePolicy: FileAssetUsagePolicy.Public,
      });

      const item = await fileAssetModel.findByFileId(fileId);

      expect(item).toMatchObject({
        classification: FileAssetClassification.Product,
        createdBy: userId,
        fileId,
        reviewStatus: FileAssetReviewStatus.Archived,
        spaceId,
        usagePolicy: FileAssetUsagePolicy.Public,
      });
    });
  });

  describe('findByFileIds', () => {
    it('should return all matching sidecars in one query', async () => {
      const secondFileId = 'file_asset_2';

      await serverDB.insert(globalFiles).values({
        creator: userId,
        fileType: 'image/png',
        hashId: 'hash_asset_2',
        size: 256,
        url: 'https://example.com/asset-2.png',
      });
      await serverDB.insert(files).values({
        fileHash: 'hash_asset_2',
        fileType: 'image/png',
        id: secondFileId,
        name: 'asset-2.png',
        size: 256,
        spaceId,
        url: 'https://example.com/asset-2.png',
        userId,
      });

      await fileAssetModel.upsert({
        createdBy: userId,
        classification: FileAssetClassification.Brand,
        fileId,
        reviewStatus: FileAssetReviewStatus.Approved,
        spaceId,
      });
      await fileAssetModel.upsert({
        createdBy: anotherUserId,
        classification: FileAssetClassification.Finance,
        fileId: secondFileId,
        reviewStatus: FileAssetReviewStatus.Archived,
        spaceId,
      });

      const items = await fileAssetModel.findByFileIds([fileId, secondFileId, 'missing']);

      expect(items).toHaveLength(2);
      expect(items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ fileId, reviewStatus: FileAssetReviewStatus.Approved }),
          expect.objectContaining({
            classification: FileAssetClassification.Finance,
            fileId: secondFileId,
            reviewStatus: FileAssetReviewStatus.Archived,
          }),
        ]),
      );
    });
  });
});
