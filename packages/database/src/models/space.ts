import type { SpaceRole } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm';

import type { NewSpace } from '../schemas';
import { spaceMembers, spaces, users } from '../schemas';
import type { LobeChatDatabase, Transaction } from '../type';
import { UserModel } from './user';

export class SpaceModel {
  private readonly db: LobeChatDatabase;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  private bumpAuthzEpoch = async (
    spaceId: string,
    trx: Transaction | LobeChatDatabase = this.db,
  ) => {
    await trx
      .update(spaces)
      .set({
        authzEpoch: sql`${spaces.authzEpoch} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(spaces.id, spaceId));
  };

  getOrCreatePersonalSpace = async () => {
    const existing = await this.db
      .select({
        authzEpoch: spaces.authzEpoch,
        createdAt: spaces.createdAt,
        createdBy: spaces.createdBy,
        deletedAt: spaces.deletedAt,
        description: spaces.description,
        id: spaces.id,
        kind: spaces.kind,
        metadata: spaces.metadata,
        name: spaces.name,
        personalOwnerId: spaces.personalOwnerId,
        updatedAt: spaces.updatedAt,
      })
      .from(spaces)
      .where(and(eq(spaces.personalOwnerId, this.userId), isNull(spaces.deletedAt)))
      .limit(1);

    if (existing[0]) return existing[0];

    const name = 'My Space';

    return this.db.transaction(async (trx) => {
      const [created] = await trx
        .insert(spaces)
        .values({
          createdBy: this.userId,
          kind: 'personal',
          name,
          personalOwnerId: this.userId,
        })
        .returning();

      await trx.insert(spaceMembers).values({
        createdBy: this.userId,
        role: 'owner',
        spaceId: created.id,
        userId: this.userId,
      });

      return created;
    });
  };

  listSpaces = async () => {
    const result = await this.db
      .select({
        authzEpoch: spaces.authzEpoch,
        createdAt: spaces.createdAt,
        createdBy: spaces.createdBy,
        deletedAt: spaces.deletedAt,
        description: spaces.description,
        id: spaces.id,
        kind: spaces.kind,
        metadata: spaces.metadata,
        membershipRole: spaceMembers.role,
        name: spaces.name,
        personalOwnerId: spaces.personalOwnerId,
        updatedAt: spaces.updatedAt,
      })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaceMembers.spaceId, spaces.id))
      .where(and(eq(spaceMembers.userId, this.userId), isNull(spaces.deletedAt)))
      .orderBy(asc(spaces.kind), asc(spaces.name));

    return result;
  };

  findAccessibleSpaceById = async (spaceId: string) => {
    const result = await this.db
      .select({
        authzEpoch: spaces.authzEpoch,
        createdAt: spaces.createdAt,
        createdBy: spaces.createdBy,
        deletedAt: spaces.deletedAt,
        description: spaces.description,
        id: spaces.id,
        kind: spaces.kind,
        metadata: spaces.metadata,
        membershipRole: spaceMembers.role,
        name: spaces.name,
        personalOwnerId: spaces.personalOwnerId,
        updatedAt: spaces.updatedAt,
      })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaceMembers.spaceId, spaces.id))
      .where(
        and(
          eq(spaceMembers.spaceId, spaceId),
          eq(spaceMembers.userId, this.userId),
          isNull(spaces.deletedAt),
        ),
      )
      .limit(1);

    return result[0];
  };

  createTeamSpace = async (params: Pick<NewSpace, 'description' | 'metadata' | 'name'>) => {
    return this.db.transaction(async (trx) => {
      const [created] = await trx
        .insert(spaces)
        .values({
          createdBy: this.userId,
          description: params.description,
          kind: 'team',
          metadata: params.metadata,
          name: params.name,
        })
        .returning();

      await trx.insert(spaceMembers).values({
        createdBy: this.userId,
        role: 'owner',
        spaceId: created.id,
        userId: this.userId,
      });

      return created;
    });
  };

  updateSpace = async (
    spaceId: string,
    value: Partial<Pick<NewSpace, 'description' | 'metadata' | 'name'>>,
  ) => {
    return this.db
      .update(spaces)
      .set({ ...value, updatedAt: new Date() })
      .where(eq(spaces.id, spaceId))
      .returning();
  };

  deleteSpace = async (spaceId: string) => {
    const space = await this.findAccessibleSpaceById(spaceId);
    if (!space) throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_NOT_FOUND' });
    if (space.kind === 'personal') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'PERSONAL_SPACE_CANNOT_BE_DELETED' });
    }

    return this.db.delete(spaces).where(eq(spaces.id, spaceId));
  };

  listMembers = async (spaceId: string) => {
    return this.db
      .select({
        avatar: users.avatar,
        fullName: users.fullName,
        joinedAt: spaceMembers.joinedAt,
        role: spaceMembers.role,
        spaceId: spaceMembers.spaceId,
        updatedAt: spaceMembers.updatedAt,
        userId: spaceMembers.userId,
        username: users.username,
      })
      .from(spaceMembers)
      .innerJoin(users, eq(spaceMembers.userId, users.id))
      .where(eq(spaceMembers.spaceId, spaceId))
      .orderBy(asc(spaceMembers.joinedAt));
  };

  addMemberByUsername = async (spaceId: string, username: string, role: SpaceRole) => {
    const user = await UserModel.findByUsername(this.db, username);
    if (!user?.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'USER_NOT_FOUND' });

    const existing = await this.db
      .select({ userId: spaceMembers.userId })
      .from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, user.id)))
      .limit(1);

    if (existing[0]) throw new TRPCError({ code: 'CONFLICT', message: 'SPACE_MEMBER_EXISTS' });

    await this.db.insert(spaceMembers).values({
      createdBy: this.userId,
      role,
      spaceId,
      userId: user.id,
    });

    await this.bumpAuthzEpoch(spaceId);

    return user;
  };

  updateMemberRole = async (spaceId: string, memberUserId: string, role: SpaceRole) => {
    await this.db
      .update(spaceMembers)
      .set({
        role,
        updatedAt: new Date(),
      })
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, memberUserId)));

    await this.bumpAuthzEpoch(spaceId);
  };

  removeMember = async (spaceId: string, memberUserId: string) => {
    const [owner] = await this.db
      .select({ userId: spaceMembers.userId })
      .from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.role, 'owner')))
      .limit(1);

    if (owner?.userId === memberUserId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'SPACE_OWNER_CANNOT_BE_REMOVED' });
    }

    await this.db
      .delete(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, memberUserId)));

    await this.bumpAuthzEpoch(spaceId);
  };

  transferOwnership = async (spaceId: string, nextOwnerUserId: string) => {
    await this.db.transaction(async (trx) => {
      const [currentOwner] = await trx
        .select({ userId: spaceMembers.userId })
        .from(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.role, 'owner')))
        .limit(1);

      if (!currentOwner?.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_OWNER_NOT_FOUND' });
      }

      const [targetMember] = await trx
        .select({ userId: spaceMembers.userId })
        .from(spaceMembers)
        .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, nextOwnerUserId)))
        .limit(1);

      if (!targetMember?.userId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'SPACE_MEMBER_NOT_FOUND' });
      }

      await trx
        .update(spaceMembers)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(
          and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, currentOwner.userId)),
        );

      await trx
        .update(spaceMembers)
        .set({ role: 'owner', updatedAt: new Date() })
        .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, nextOwnerUserId)));

      await this.bumpAuthzEpoch(spaceId, trx);
    });
  };

  getMemberRole = async (spaceId: string, userId: string = this.userId) => {
    const result = await this.db
      .select({ role: spaceMembers.role })
      .from(spaceMembers)
      .where(and(eq(spaceMembers.spaceId, spaceId), eq(spaceMembers.userId, userId)))
      .limit(1);

    return result[0]?.role;
  };

  listNonOwnerTeamSpaces = async () => {
    return this.db
      .select({
        id: spaces.id,
        membershipRole: spaceMembers.role,
        name: spaces.name,
      })
      .from(spaceMembers)
      .innerJoin(spaces, eq(spaceMembers.spaceId, spaces.id))
      .where(
        and(
          eq(spaceMembers.userId, this.userId),
          eq(spaces.kind, 'team'),
          isNull(spaces.deletedAt),
          ne(spaceMembers.role, 'owner'),
        ),
      );
  };

  static findPersonalSpaceByOwnerId = async (db: LobeChatDatabase, userId: string) =>
    db.query.spaces.findFirst({
      where: and(eq(spaces.personalOwnerId, userId), isNull(spaces.deletedAt)),
    });
}
