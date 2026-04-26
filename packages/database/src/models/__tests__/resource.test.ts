// @vitest-environment node
import { inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { spaces, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { ContentModel } from '../content';
import { DocumentModel } from '../document';
import { FileModel } from '../file';
import { SpaceModel } from '../space';

const serverDB: LobeChatDatabase = await getTestDB();

const viewerId = 'resource-model-test-viewer';
const ownerId = 'resource-model-test-owner';

beforeEach(async () => {
  await serverDB.delete(spaces).where(inArray(spaces.personalOwnerId, [viewerId, ownerId]));
  await serverDB.delete(users).where(inArray(users.id, [viewerId, ownerId]));
  await serverDB.insert(users).values([
    { id: ownerId, username: 'resource-model-owner' },
    { id: viewerId, username: 'resource-model-viewer' },
  ]);
});

afterEach(async () => {
  await serverDB.delete(spaces).where(inArray(spaces.personalOwnerId, [viewerId, ownerId]));
  await serverDB.delete(users).where(inArray(users.id, [viewerId, ownerId]));
});

describe('ContentModel', () => {
  describe('listSharedWithMe', () => {
    it('should exclude resources created by the current user', async () => {
      const viewerFileModel = new FileModel(serverDB, viewerId);
      const viewerResourceModel = new ContentModel(serverDB, viewerId);
      const viewerSpaceModel = new SpaceModel(serverDB, viewerId);

      const ownerFileModel = new FileModel(serverDB, ownerId);
      const ownerResourceModel = new ContentModel(serverDB, ownerId);
      const ownerSpaceModel = new SpaceModel(serverDB, ownerId);

      const viewerSpace = await viewerSpaceModel.getOrCreatePersonalSpace();
      const ownerSpace = await ownerSpaceModel.getOrCreatePersonalSpace();

      const { id: selfFileId } = await viewerFileModel.create(
        {
          fileType: 'text/plain',
          name: 'self.txt',
          size: 1,
          spaceId: viewerSpace.id,
          url: 'https://example.com/self.txt',
        },
        false,
      );
      const selfRegistry = await viewerResourceModel.ensureContentRegistry({
        createdBy: viewerId,
        kind: 'file',
        localId: selfFileId,
        spaceId: viewerSpace.id,
      });
      await viewerResourceModel.ensureOwnerPermission({
        contentUid: selfRegistry.contentUid,
        spaceId: viewerSpace.id,
      });

      const { id: sharedFileId } = await ownerFileModel.create(
        {
          fileType: 'text/plain',
          name: 'shared.txt',
          size: 1,
          spaceId: ownerSpace.id,
          url: 'https://example.com/shared.txt',
        },
        false,
      );
      const sharedRegistry = await ownerResourceModel.ensureContentRegistry({
        createdBy: ownerId,
        kind: 'file',
        localId: sharedFileId,
        spaceId: ownerSpace.id,
      });
      await ownerResourceModel.ensureOwnerPermission({
        contentUid: sharedRegistry.contentUid,
        spaceId: ownerSpace.id,
      });
      await ownerResourceModel.grantPermission({
        canReshare: false,
        createdBy: ownerId,
        inheritsToChildren: true,
        contentUid: sharedRegistry.contentUid,
        role: 'viewer',
        spaceId: ownerSpace.id,
        subjectId: viewerId,
        subjectType: 'user',
      });

      const items = await viewerResourceModel.listSharedWithMe();

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        createdBy: ownerId,
        kind: 'file',
        localId: sharedFileId,
        name: 'shared.txt',
        contentUid: sharedRegistry.contentUid,
      });
      expect(items.find((item) => item.contentUid === selfRegistry.contentUid)).toBeUndefined();
    });

    it('should include shared document metadata for route resolution', async () => {
      const viewerResourceModel = new ContentModel(serverDB, viewerId);
      const viewerSpaceModel = new SpaceModel(serverDB, viewerId);

      const ownerDocumentModel = new DocumentModel(serverDB, ownerId);
      const ownerFileModel = new FileModel(serverDB, ownerId);
      const ownerResourceModel = new ContentModel(serverDB, ownerId);
      const ownerSpaceModel = new SpaceModel(serverDB, ownerId);

      await viewerSpaceModel.getOrCreatePersonalSpace();
      const ownerSpace = await ownerSpaceModel.getOrCreatePersonalSpace();

      const { id: fileId } = await ownerFileModel.create(
        {
          fileType: 'text/markdown',
          name: 'shared-table.md',
          size: 32,
          spaceId: ownerSpace.id,
          url: 'https://example.com/shared-table.md',
        },
        false,
      );
      const file = await ownerFileModel.findById(fileId);
      if (!file) throw new Error('File not found after creation');

      const document = await ownerDocumentModel.create({
        content: '| name |\n| --- |\n| ops |',
        fileId: file.id,
        fileType: 'custom/document',
        metadata: { pageKind: 'table' },
        source: file.url,
        sourceType: 'file',
        spaceId: ownerSpace.id,
        title: 'Shared Table',
        totalCharCount: 25,
        totalLineCount: 3,
      });

      const registry = await ownerResourceModel.ensureContentRegistry({
        createdBy: ownerId,
        kind: 'document',
        localId: document.id,
        spaceId: ownerSpace.id,
      });
      await ownerResourceModel.ensureOwnerPermission({
        contentUid: registry.contentUid,
        spaceId: ownerSpace.id,
      });
      await ownerResourceModel.grantPermission({
        canReshare: false,
        createdBy: ownerId,
        inheritsToChildren: true,
        contentUid: registry.contentUid,
        role: 'viewer',
        spaceId: ownerSpace.id,
        subjectId: viewerId,
        subjectType: 'user',
      });

      const items = await viewerResourceModel.listSharedWithMe();

      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        contentUid: registry.contentUid,
        createdBy: ownerId,
        fileType: 'custom/document',
        kind: 'document',
        localId: document.id,
        metadata: { pageKind: 'table' },
        name: 'Shared Table',
        spaceId: ownerSpace.id,
      });
    });
  });
});
