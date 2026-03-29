// @vitest-environment node
import { and, eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { sleep } from '@/utils/sleep';

import { getTestDB } from '../../core/getTestDB';
import type { NewSourceSet } from '../../schemas';
import { documents, files, globalFiles, sourceSetFiles, sourceSets, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { SourceSetModel } from '../sourceSet';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'session-group-model-test-user-id';
const sourceSetModel = new SourceSetModel(serverDB, userId);

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.delete(globalFiles);
  await serverDB.insert(users).values([{ id: userId }, { id: 'user2' }]);
});

afterEach(async () => {
  await serverDB.delete(users).where(eq(users.id, userId));
  await serverDB.delete(sourceSets).where(eq(sourceSets.userId, userId));
});

describe('SourceSetModel', () => {
  describe('create', () => {
    it('should create a new source set', async () => {
      const params = {
        name: 'Test Group',
      } as NewSourceSet;

      const result = await sourceSetModel.create(params);
      expect(result.id).toBeDefined();
      expect(result).toMatchObject({ ...params, userId });

      const group = await serverDB.query.sourceSets.findFirst({
        where: eq(sourceSets.id, result.id),
      });
      expect(group).toMatchObject({ ...params, userId });
    });
  });
  describe('delete', () => {
    it('should delete a source set by id', async () => {
      const { id } = await sourceSetModel.create({ name: 'Test Group' });

      await sourceSetModel.delete(id);

      const group = await serverDB.query.sourceSets.findFirst({
        where: eq(sourceSets.id, id),
      });
      expect(group).toBeUndefined();
    });
  });
  describe('deleteAll', () => {
    it('should delete all source sets for the user', async () => {
      await sourceSetModel.create({ name: 'Test Group 1' });
      await sourceSetModel.create({ name: 'Test Group 2' });

      await sourceSetModel.deleteAll();

      const userGroups = await serverDB.query.sourceSets.findMany({
        where: eq(sourceSets.userId, userId),
      });
      expect(userGroups).toHaveLength(0);
    });
    it('should only delete source sets for the user, not others', async () => {
      await sourceSetModel.create({ name: 'Test Group 1' });
      await sourceSetModel.create({ name: 'Test Group 333' });

      const anotherSessionGroupModel = new SourceSetModel(serverDB, 'user2');
      await anotherSessionGroupModel.create({ name: 'Test Group 2' });

      await sourceSetModel.deleteAll();

      const userGroups = await serverDB.query.sourceSets.findMany({
        where: eq(sourceSets.userId, userId),
      });
      const total = await serverDB.query.sourceSets.findMany();
      expect(userGroups).toHaveLength(0);
      expect(total).toHaveLength(1);
    });
  });

  describe('query', () => {
    it('should query source sets for the user', async () => {
      await sourceSetModel.create({ name: 'Test Group 1' });
      await sleep(50);
      await sourceSetModel.create({ name: 'Test Group 2' });

      const userGroups = await sourceSetModel.query();
      expect(userGroups).toHaveLength(2);
      expect(userGroups[0].name).toBe('Test Group 2');
      expect(userGroups[1].name).toBe('Test Group 1');
    });
  });

  describe('findById', () => {
    it('should find a source set by id', async () => {
      const { id } = await sourceSetModel.create({ name: 'Test Group' });

      const group = await sourceSetModel.findById(id);
      expect(group).toMatchObject({
        id,
        name: 'Test Group',
        userId,
      });
    });
  });

  describe('update', () => {
    it('should update a source set', async () => {
      const { id } = await sourceSetModel.create({ name: 'Test Group' });

      await sourceSetModel.update(id, { name: 'Updated Test Group' });

      const updatedGroup = await serverDB.query.sourceSets.findFirst({
        where: eq(sourceSets.id, id),
      });
      expect(updatedGroup).toMatchObject({
        id,
        name: 'Updated Test Group',
        userId,
      });
    });
  });

  const fileList = [
    {
      id: 'file1',
      name: 'document.pdf',
      url: 'https://example.com/document.pdf',
      fileHash: 'hash1',
      size: 1000,
      fileType: 'application/pdf',
      userId,
    },
    {
      id: 'file2',
      name: 'image.jpg',
      url: 'https://example.com/image.jpg',
      fileHash: 'hash2',
      size: 500,
      fileType: 'image/jpeg',
      userId,
    },
  ];

  describe('addFilesToSourceSet', () => {
    it('should add files to a source set', async () => {
      await serverDB.insert(globalFiles).values([
        {
          hashId: 'hash1',
          url: 'https://example.com/document.pdf',
          size: 1000,
          fileType: 'application/pdf',
          creator: userId,
        },
        {
          hashId: 'hash2',
          url: 'https://example.com/image.jpg',
          size: 500,
          fileType: 'image/jpeg',
          creator: userId,
        },
      ]);

      await serverDB.insert(files).values(fileList);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Test Group' });
      const fileIds = ['file1', 'file2'];

      const result = await sourceSetModel.addFilesToSourceSet(sourceSetId, fileIds);

      expect(result).toHaveLength(2);
      expect(result).toEqual(
        expect.arrayContaining(
          fileIds.map((fileId) => expect.objectContaining({ fileId, sourceSetId })),
        ),
      );

      const addedFiles = await serverDB.query.sourceSetFiles.findMany({
        where: eq(sourceSetFiles.sourceSetId, sourceSetId),
      });
      expect(addedFiles).toHaveLength(2);
    });

    it('should add documents (with docs_ prefix) to a source set by resolving to file IDs', async () => {
      await serverDB.insert(globalFiles).values([
        {
          hashId: 'hash1',
          url: 'https://example.com/document.pdf',
          size: 1000,
          fileType: 'application/pdf',
          creator: userId,
        },
      ]);

      // Create mirror file first (document references it via fileId)
      await serverDB.insert(files).values([
        {
          id: 'file1',
          name: 'document.pdf',
          url: 'https://example.com/document.pdf',
          fileHash: 'hash1',
          size: 1000,
          fileType: 'application/pdf',
          userId,
        },
      ]);

      // Create document with fileId pointing to the mirror file
      await serverDB.insert(documents).values([
        {
          id: 'docs_test123',
          title: 'Test Document',
          content: 'Test content',
          fileType: 'application/pdf',
          totalCharCount: 100,
          totalLineCount: 10,
          sourceType: 'file',
          source: 'test.pdf',
          fileId: 'file1',
          userId,
        },
      ]);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Test Group' });

      // Pass document ID (with docs_ prefix)
      const result = await sourceSetModel.addFilesToSourceSet(sourceSetId, ['docs_test123']);

      // Should resolve to file1 and insert that
      expect(result).toHaveLength(1);
      expect(result[0].fileId).toBe('file1');
      expect(result[0].sourceSetId).toBe(sourceSetId);

      const addedFiles = await serverDB.query.sourceSetFiles.findMany({
        where: eq(sourceSetFiles.sourceSetId, sourceSetId),
      });
      expect(addedFiles).toHaveLength(1);
      expect(addedFiles[0].fileId).toBe('file1');

      // Verify document.sourceSetId was updated
      const document = await serverDB.query.documents.findFirst({
        where: eq(documents.id, 'docs_test123'),
      });
      expect(document?.sourceSetId).toBe(sourceSetId);
    });

    it('should return empty array when all document IDs resolve to null fileIds', async () => {
      // Create a document without a fileId (fileId is null)
      await serverDB.insert(documents).values([
        {
          id: 'docs_no_file',
          title: 'Document without file',
          content: 'Test content',
          fileType: 'text/plain',
          totalCharCount: 50,
          totalLineCount: 5,
          sourceType: 'file',
          source: 'test.txt',
          fileId: null,
          userId,
        },
      ]);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Test Group' });

      // Pass only document IDs whose fileId is null => resolvedFileIds will be empty
      const result = await sourceSetModel.addFilesToSourceSet(sourceSetId, ['docs_no_file']);

      expect(result).toEqual([]);

      // Verify no files were added to the source set
      const addedFiles = await serverDB.query.sourceSetFiles.findMany({
        where: eq(sourceSetFiles.sourceSetId, sourceSetId),
      });
      expect(addedFiles).toHaveLength(0);
    });

    it('should handle mixed document IDs and file IDs', async () => {
      await serverDB.insert(globalFiles).values([
        {
          hashId: 'hash1',
          url: 'https://example.com/document.pdf',
          size: 1000,
          fileType: 'application/pdf',
          creator: userId,
        },
        {
          hashId: 'hash2',
          url: 'https://example.com/image.jpg',
          size: 500,
          fileType: 'image/jpeg',
          creator: userId,
        },
      ]);

      // Create files - file1 is mirror of the document, file2 is standalone
      await serverDB.insert(files).values([
        {
          id: 'file1',
          name: 'document.pdf',
          url: 'https://example.com/document.pdf',
          fileHash: 'hash1',
          size: 1000,
          fileType: 'application/pdf',
          userId,
        },
        fileList[1], // file2 - standalone file
      ]);

      // Create document with fileId pointing to the mirror file
      await serverDB.insert(documents).values([
        {
          id: 'docs_test456',
          title: 'Test Document',
          content: 'Test content',
          fileType: 'application/pdf',
          totalCharCount: 100,
          totalLineCount: 10,
          sourceType: 'file',
          source: 'test.pdf',
          fileId: 'file1',
          userId,
        },
      ]);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Test Group' });

      // Mix of document ID and direct file ID
      const result = await sourceSetModel.addFilesToSourceSet(sourceSetId, [
        'docs_test456',
        'file2',
      ]);

      expect(result).toHaveLength(2);
      const fileIds = result.map((r) => r.fileId).sort();
      expect(fileIds).toEqual(['file1', 'file2']);
    });

    it('should add folder descendants and nested files when attaching a folder root', async () => {
      await serverDB.insert(globalFiles).values([
        {
          hashId: 'hash-folder-mirror',
          url: 'https://example.com/folder-child.pdf',
          size: 1000,
          fileType: 'application/pdf',
          creator: userId,
        },
        {
          hashId: 'hash-folder-direct',
          url: 'https://example.com/nested-note.txt',
          size: 100,
          fileType: 'text/plain',
          creator: userId,
        },
      ]);

      await serverDB.insert(files).values([
        {
          id: 'file_folder_mirror',
          name: 'folder-child.pdf',
          url: 'https://example.com/folder-child.pdf',
          fileHash: 'hash-folder-mirror',
          size: 1000,
          fileType: 'application/pdf',
          userId,
        },
      ]);

      await serverDB.insert(documents).values([
        {
          id: 'docs_folder_root',
          title: 'Root Folder',
          content: '',
          fileType: 'custom/folder',
          totalCharCount: 0,
          totalLineCount: 0,
          sourceType: 'api',
          source: 'folder',
          fileId: null,
          userId,
        },
        {
          id: 'docs_folder_child',
          title: 'Child Doc',
          content: 'Folder child',
          fileType: 'application/pdf',
          totalCharCount: 12,
          totalLineCount: 1,
          sourceType: 'file',
          source: 'folder-child.pdf',
          fileId: 'file_folder_mirror',
          parentId: 'docs_folder_root',
          userId,
        },
        {
          id: 'docs_folder_nested',
          title: 'Nested Folder',
          content: '',
          fileType: 'custom/folder',
          totalCharCount: 0,
          totalLineCount: 0,
          sourceType: 'api',
          source: 'folder',
          fileId: null,
          parentId: 'docs_folder_root',
          userId,
        },
      ]);

      await serverDB.insert(files).values([
        {
          id: 'file_folder_nested',
          name: 'nested-note.txt',
          url: 'https://example.com/nested-note.txt',
          fileHash: 'hash-folder-direct',
          parentId: 'docs_folder_nested',
          size: 100,
          fileType: 'text/plain',
          userId,
        },
      ]);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Folder Tree' });

      const result = await sourceSetModel.addFilesToSourceSet(sourceSetId, ['docs_folder_root']);

      const addedFileIds = result.map((item) => item.fileId).sort();
      expect(addedFileIds).toEqual(['file_folder_mirror', 'file_folder_nested']);

      const updatedDocuments = await serverDB.query.documents.findMany({
        where: inArray(documents.id, [
          'docs_folder_root',
          'docs_folder_child',
          'docs_folder_nested',
        ]),
      });
      expect(updatedDocuments.every((item) => item.sourceSetId === sourceSetId)).toBe(true);
    });
  });

  describe('removeFilesFromSourceSet', () => {
    it('should remove files from a source set', async () => {
      await serverDB.insert(globalFiles).values([
        {
          hashId: 'hash1',
          url: 'https://example.com/document.pdf',
          size: 1000,
          fileType: 'application/pdf',
          creator: userId,
        },
        {
          hashId: 'hash2',
          url: 'https://example.com/image.jpg',
          size: 500,
          fileType: 'image/jpeg',
          creator: userId,
        },
      ]);

      await serverDB.insert(files).values(fileList);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Test Group' });
      const fileIds = ['file1', 'file2'];
      await sourceSetModel.addFilesToSourceSet(sourceSetId, fileIds);

      const filesToRemove = ['file1'];
      await sourceSetModel.removeFilesFromSourceSet(sourceSetId, filesToRemove);

      const remainingFiles = await serverDB.query.sourceSetFiles.findMany({
        where: and(eq(sourceSetFiles.sourceSetId, sourceSetId)),
      });
      expect(remainingFiles).toHaveLength(1);
      expect(remainingFiles[0].fileId).toBe('file2');
    });

    it('should remove documents (with docs_ prefix) from a source set by resolving to file IDs', async () => {
      await serverDB.insert(globalFiles).values([
        {
          hashId: 'hash1',
          url: 'https://example.com/document.pdf',
          size: 1000,
          fileType: 'application/pdf',
          creator: userId,
        },
      ]);

      // Create mirror file first (document references it via fileId)
      await serverDB.insert(files).values([
        {
          id: 'file1',
          name: 'document.pdf',
          url: 'https://example.com/document.pdf',
          fileHash: 'hash1',
          size: 1000,
          fileType: 'application/pdf',
          userId,
        },
      ]);

      // Create document with fileId pointing to the mirror file
      await serverDB.insert(documents).values([
        {
          id: 'docs_test789',
          title: 'Test Document',
          content: 'Test content',
          fileType: 'application/pdf',
          totalCharCount: 100,
          totalLineCount: 10,
          sourceType: 'file',
          source: 'test.pdf',
          fileId: 'file1',
          userId,
        },
      ]);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Test Group' });
      await sourceSetModel.addFilesToSourceSet(sourceSetId, ['docs_test789']);

      // Remove using document ID
      await sourceSetModel.removeFilesFromSourceSet(sourceSetId, ['docs_test789']);

      const remainingFiles = await serverDB.query.sourceSetFiles.findMany({
        where: eq(sourceSetFiles.sourceSetId, sourceSetId),
      });
      expect(remainingFiles).toHaveLength(0);

      // Verify document.sourceSetId was cleared
      const document = await serverDB.query.documents.findFirst({
        where: eq(documents.id, 'docs_test789'),
      });
      expect(document?.sourceSetId).toBeNull();
    });

    it('should handle removing document IDs that resolve to null fileIds (empty resolvedFileIds)', async () => {
      await serverDB.insert(globalFiles).values([
        {
          hashId: 'hash1',
          url: 'https://example.com/document.pdf',
          size: 1000,
          fileType: 'application/pdf',
          creator: userId,
        },
      ]);

      await serverDB.insert(files).values([
        {
          id: 'file1',
          name: 'document.pdf',
          url: 'https://example.com/document.pdf',
          fileHash: 'hash1',
          size: 1000,
          fileType: 'application/pdf',
          userId,
        },
      ]);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Test Group' });
      await sourceSetModel.addFilesToSourceSet(sourceSetId, ['file1']);

      // Create a document without a fileId (fileId is null)
      await serverDB.insert(documents).values([
        {
          id: 'docs_null_file',
          title: 'Document without file',
          content: 'Test content',
          fileType: 'text/plain',
          totalCharCount: 50,
          totalLineCount: 5,
          sourceType: 'file',
          source: 'test.txt',
          fileId: null,
          sourceSetId,
          userId,
        },
      ]);

      // Try to remove using only a document ID whose fileId is null
      // resolvedFileIds will be empty after filtering, so the early return on line 109-111 is hit
      await sourceSetModel.removeFilesFromSourceSet(sourceSetId, ['docs_null_file']);

      // The existing file should still be in the source set
      const remainingFiles = await serverDB.query.sourceSetFiles.findMany({
        where: eq(sourceSetFiles.sourceSetId, sourceSetId),
      });
      expect(remainingFiles).toHaveLength(1);
      expect(remainingFiles[0].fileId).toBe('file1');
    });

    it('should not allow removing files from another user source set', async () => {
      await serverDB.insert(globalFiles).values([
        {
          hashId: 'hash1',
          url: 'https://example.com/document.pdf',
          size: 1000,
          fileType: 'application/pdf',
          creator: userId,
        },
      ]);

      await serverDB.insert(files).values([fileList[0]]);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Test Group' });
      await sourceSetModel.addFilesToSourceSet(sourceSetId, ['file1']);

      // Another user tries to remove files from this source set
      const attackerModel = new SourceSetModel(serverDB, 'user2');
      await attackerModel.removeFilesFromSourceSet(sourceSetId, ['file1']);

      // Files should still exist since the attacker doesn't own them
      const remainingFiles = await serverDB.query.sourceSetFiles.findMany({
        where: eq(sourceSetFiles.sourceSetId, sourceSetId),
      });
      expect(remainingFiles).toHaveLength(1);
      expect(remainingFiles[0].fileId).toBe('file1');
    });

    it('should remove folder descendants and nested files when detaching a folder root', async () => {
      await serverDB.insert(globalFiles).values([
        {
          hashId: 'hash-folder-mirror-remove',
          url: 'https://example.com/remove-child.pdf',
          size: 1000,
          fileType: 'application/pdf',
          creator: userId,
        },
        {
          hashId: 'hash-folder-direct-remove',
          url: 'https://example.com/remove-note.txt',
          size: 100,
          fileType: 'text/plain',
          creator: userId,
        },
      ]);

      await serverDB.insert(files).values([
        {
          id: 'file_remove_mirror',
          name: 'remove-child.pdf',
          url: 'https://example.com/remove-child.pdf',
          fileHash: 'hash-folder-mirror-remove',
          size: 1000,
          fileType: 'application/pdf',
          userId,
        },
      ]);

      await serverDB.insert(documents).values([
        {
          id: 'docs_remove_root',
          title: 'Root Folder',
          content: '',
          fileType: 'custom/folder',
          totalCharCount: 0,
          totalLineCount: 0,
          sourceType: 'api',
          source: 'folder',
          fileId: null,
          userId,
        },
        {
          id: 'docs_remove_child',
          title: 'Child Doc',
          content: 'Child',
          fileType: 'application/pdf',
          totalCharCount: 5,
          totalLineCount: 1,
          sourceType: 'file',
          source: 'remove-child.pdf',
          fileId: 'file_remove_mirror',
          parentId: 'docs_remove_root',
          userId,
        },
        {
          id: 'docs_remove_nested',
          title: 'Nested Folder',
          content: '',
          fileType: 'custom/folder',
          totalCharCount: 0,
          totalLineCount: 0,
          sourceType: 'api',
          source: 'folder',
          fileId: null,
          parentId: 'docs_remove_root',
          userId,
        },
      ]);

      await serverDB.insert(files).values([
        {
          id: 'file_remove_nested',
          name: 'remove-note.txt',
          url: 'https://example.com/remove-note.txt',
          fileHash: 'hash-folder-direct-remove',
          parentId: 'docs_remove_nested',
          size: 100,
          fileType: 'text/plain',
          userId,
        },
      ]);

      const { id: sourceSetId } = await sourceSetModel.create({ name: 'Folder Tree' });
      await sourceSetModel.addFilesToSourceSet(sourceSetId, ['docs_remove_root']);

      await sourceSetModel.removeFilesFromSourceSet(sourceSetId, ['docs_remove_root']);

      const remainingFiles = await serverDB.query.sourceSetFiles.findMany({
        where: eq(sourceSetFiles.sourceSetId, sourceSetId),
      });
      expect(remainingFiles).toHaveLength(0);

      const updatedDocuments = await serverDB.query.documents.findMany({
        where: inArray(documents.id, [
          'docs_remove_root',
          'docs_remove_child',
          'docs_remove_nested',
        ]),
      });
      expect(updatedDocuments.every((item) => item.sourceSetId === null)).toBe(true);
    });
  });

  describe('static findById', () => {
    it('should find a source set by id without user restriction', async () => {
      const { id } = await sourceSetModel.create({ name: 'Test Group' });

      const group = await SourceSetModel.findById(serverDB, id);
      expect(group).toMatchObject({
        id,
        name: 'Test Group',
        userId,
      });
    });

    it('should find a source set created by another user', async () => {
      const anotherSourceSetModel = new SourceSetModel(serverDB, 'user2');
      const { id } = await anotherSourceSetModel.create({ name: 'Another User Group' });

      const group = await SourceSetModel.findById(serverDB, id);
      expect(group).toMatchObject({
        id,
        name: 'Another User Group',
        userId: 'user2',
      });
    });
  });
});
