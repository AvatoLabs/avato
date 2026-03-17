// @vitest-environment node
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { sessionTags, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { SessionTagModel } from '../sessionTag';

const serverDB: LobeChatDatabase = await getTestDB();

const userId = 'session-tag-model-test-user-id';
const sessionTagModel = new SessionTagModel(serverDB, userId);

beforeEach(async () => {
  await serverDB.delete(users);
  await serverDB.insert(users).values([{ id: userId }, { id: 'user2' }]);
});

afterEach(async () => {
  await serverDB.delete(users).where(eq(users.id, userId));
  await serverDB.delete(sessionTags).where(eq(sessionTags.userId, userId));
});

describe('SessionTagModel', () => {
  describe('create', () => {
    it('should create a new session tag', async () => {
      const params = {
        color: '#FF4D4F',
        name: 'Urgent',
        sort: 1,
      };

      const result = await sessionTagModel.create(params);
      expect(result.id).toBeDefined();
      expect(result).toMatchObject({ ...params, userId });

      const tag = await serverDB.query.sessionTags.findFirst({
        where: eq(sessionTags.id, result.id),
      });
      expect(tag).toMatchObject({ ...params, userId });
    });
  });

  describe('delete', () => {
    it('should delete a session tag by id', async () => {
      const { id } = await sessionTagModel.create({ name: 'Urgent' });

      await sessionTagModel.delete(id);

      const tag = await serverDB.query.sessionTags.findFirst({
        where: eq(sessionTags.id, id),
      });
      expect(tag).toBeUndefined();
    });
  });

  describe('deleteAll', () => {
    it('should delete all session tags for the user', async () => {
      await sessionTagModel.create({ name: 'Urgent' });
      await sessionTagModel.create({ name: 'Ideas' });

      await sessionTagModel.deleteAll();

      const userTags = await serverDB.query.sessionTags.findMany({
        where: eq(sessionTags.userId, userId),
      });
      expect(userTags).toHaveLength(0);
    });

    it('should only delete session tags for the user, not others', async () => {
      await sessionTagModel.create({ name: 'Urgent' });

      const anotherSessionTagModel = new SessionTagModel(serverDB, 'user2');
      await anotherSessionTagModel.create({ name: 'Ideas' });

      await sessionTagModel.deleteAll();

      const userTags = await serverDB.query.sessionTags.findMany({
        where: eq(sessionTags.userId, userId),
      });
      const total = await serverDB.query.sessionTags.findMany();
      expect(userTags).toHaveLength(0);
      expect(total).toHaveLength(1);
    });
  });

  describe('query', () => {
    it('should query session tags for the user', async () => {
      await sessionTagModel.create({ name: 'Later', sort: 2 });
      await sessionTagModel.create({ name: 'Urgent', sort: 1 });

      const userTags = await sessionTagModel.query();
      expect(userTags).toHaveLength(2);
      expect(userTags[0].name).toBe('Urgent');
      expect(userTags[1].name).toBe('Later');
    });
  });

  describe('findById', () => {
    it('should find a session tag by id', async () => {
      const { id } = await sessionTagModel.create({ color: '#1677FF', name: 'Ideas' });

      const tag = await sessionTagModel.findById(id);
      expect(tag).toMatchObject({
        color: '#1677FF',
        id,
        name: 'Ideas',
        userId,
      });
    });
  });

  describe('update', () => {
    it('should update a session tag', async () => {
      const { id } = await sessionTagModel.create({ name: 'Ideas' });

      await sessionTagModel.update(id, { color: '#52C41A', name: 'Updated Ideas', sort: 3 });

      const updatedTag = await serverDB.query.sessionTags.findFirst({
        where: eq(sessionTags.id, id),
      });
      expect(updatedTag).toMatchObject({
        color: '#52C41A',
        id,
        name: 'Updated Ideas',
        sort: 3,
        userId,
      });
    });
  });

  describe('updateOrder', () => {
    it('should update order of session tags', async () => {
      const tag1 = await sessionTagModel.create({ name: 'Urgent', sort: 1 });
      const tag2 = await sessionTagModel.create({ name: 'Ideas', sort: 2 });

      await sessionTagModel.updateOrder([
        { id: tag1.id, sort: 3 },
        { id: tag2.id, sort: 4 },
      ]);

      const updatedTag1 = await serverDB.query.sessionTags.findFirst({
        where: eq(sessionTags.id, tag1.id),
      });
      const updatedTag2 = await serverDB.query.sessionTags.findFirst({
        where: eq(sessionTags.id, tag2.id),
      });

      expect(updatedTag1?.sort).toBe(3);
      expect(updatedTag2?.sort).toBe(4);
    });
  });
});
