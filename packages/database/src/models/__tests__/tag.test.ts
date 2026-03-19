import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import { getTestDB } from '../../core/getTestDB';
import { tags, users } from '../../schemas';
import type { LobeChatDatabase } from '../../type';
import { TagModel } from '../tag';

const serverDB: LobeChatDatabase = await getTestDB();
const userId = 'user1';
const tagModel = new TagModel(serverDB, userId);

async function cleanup() {
  await serverDB.delete(tags).where(eq(tags.userId, userId));
}

beforeEach(async () => {
  await serverDB.delete(tags).where(eq(tags.userId, userId));
  await serverDB.delete(users).where(eq(users.id, userId));
  await serverDB.delete(users).where(eq(users.id, 'user2'));
  await serverDB.insert(users).values([{ id: userId }, { id: 'user2' }]);
});
afterAll(async () => {
  await serverDB.delete(tags).where(eq(tags.userId, userId));
});

describe('TagModel', () => {
  it('create', async () => {
    const params = { name: 'Ideas' };
    const result = await tagModel.create(params);

    expect(result).toBeDefined();
    expect(result?.id).toBeDefined();
    expect(result?.name).toBe(params.name);

    const tag = await serverDB.query.tags.findFirst({
      where: eq(tags.id, result.id),
    });
    expect(tag?.name).toBe(params.name);
  });

  it('delete', async () => {
    const { id } = await tagModel.create({ name: 'Urgent' });

    await tagModel.delete(id);

    const tag = await serverDB.query.tags.findFirst({
      where: eq(tags.id, id),
    });
    expect(tag).toBeUndefined();
  });

  it('deleteAll', async () => {
    await tagModel.create({ name: 'Urgent' });
    await tagModel.create({ name: 'Ideas' });

    await tagModel.deleteAll();

    const userTags = await serverDB.query.tags.findMany({
      where: eq(tags.userId, userId),
    });
    expect(userTags).toHaveLength(0);
  });

  it('deleteAll only deletes current user tags', async () => {
    await tagModel.create({ name: 'Urgent' });

    const anotherTagModel = new TagModel(serverDB, 'user2');
    await anotherTagModel.create({ name: 'Ideas' });

    await tagModel.deleteAll();

    const userTags = await serverDB.query.tags.findMany({
      where: eq(tags.userId, userId),
    });
    const total = await serverDB.query.tags.findMany();
    expect(userTags).toHaveLength(0);
    expect(total).toHaveLength(1);
  });

  it('query returns tags sorted by sort then createdAt', async () => {
    await tagModel.create({ name: 'Later', sort: 2 });
    await tagModel.create({ name: 'Urgent', sort: 1 });

    const userTags = await tagModel.query();

    expect(userTags).toHaveLength(2);
    expect(userTags[0].name).toBe('Urgent');
    expect(userTags[1].name).toBe('Later');
  });

  it('findById', async () => {
    const { id } = await tagModel.create({ color: '#1677FF', name: 'Ideas' });

    const tag = await tagModel.findById(id);

    expect(tag).toBeDefined();
    expect(tag?.id).toBe(id);
    expect(tag?.name).toBe('Ideas');
  });

  it('update', async () => {
    const { id } = await tagModel.create({ name: 'Ideas' });

    await tagModel.update(id, { color: '#52C41A', name: 'Updated Ideas', sort: 3 });

    const updatedTag = await serverDB.query.tags.findFirst({
      where: eq(tags.id, id),
    });
    expect(updatedTag?.name).toBe('Updated Ideas');
    expect(updatedTag?.color).toBe('#52C41A');
    expect(updatedTag?.sort).toBe(3);
  });

  it('updateOrder', async () => {
    const tag1 = await tagModel.create({ name: 'Urgent', sort: 1 });
    const tag2 = await tagModel.create({ name: 'Ideas', sort: 2 });

    await tagModel.updateOrder([
      { id: tag1.id, sort: 2 },
      { id: tag2.id, sort: 1 },
    ]);

    const updatedTag1 = await serverDB.query.tags.findFirst({
      where: eq(tags.id, tag1.id),
    });
    const updatedTag2 = await serverDB.query.tags.findFirst({
      where: eq(tags.id, tag2.id),
    });
    expect(updatedTag1?.sort).toBe(2);
    expect(updatedTag2?.sort).toBe(1);
  });
});
