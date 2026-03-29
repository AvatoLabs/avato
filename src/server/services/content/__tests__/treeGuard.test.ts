// @vitest-environment node
import type { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';

import { TreeGuard } from '../index';

const selectResult = <T>(value: T[]) => ({
  from: () => ({
    where: () => ({
      limit: () => Promise.resolve(value),
    }),
  }),
});

describe('TreeGuard', () => {
  it('rejects non-folder parents', async () => {
    const db = {
      select: vi.fn(() =>
        selectResult([
          {
            fileType: 'custom/document',
            id: 'docs_parent',
            parentId: null,
            spaceId: 'spc_test',
          },
        ]),
      ),
    } as any;

    const guard = new TreeGuard(db, 'user-1') as any;
    guard.authorizer = { assertCapability: vi.fn() };

    await expect(
      guard.assertParentAssignment({
        currentSpaceId: 'spc_test',
        parentId: 'docs_parent',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'PARENT_IS_NOT_FOLDER',
    } satisfies Partial<TRPCError>);
  });

  it('rejects moving a folder into its own descendant chain', async () => {
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          selectResult([
            {
              fileType: 'custom/folder',
              id: 'docs_child',
              parentId: 'docs_root',
              spaceId: 'spc_test',
            },
          ]),
        )
        .mockImplementationOnce(() => selectResult([{ parentId: 'docs_root' }])),
    } as any;

    const guard = new TreeGuard(db, 'user-1') as any;
    guard.authorizer = { assertCapability: vi.fn() };

    await expect(
      guard.assertParentAssignment({
        currentSpaceId: 'spc_test',
        itemId: 'docs_root',
        parentId: 'docs_child',
      }),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'CYCLE_MOVE_NOT_ALLOWED',
    } satisfies Partial<TRPCError>);
  });

  it('allows valid folder parents and checks create_child capability', async () => {
    const assertCapability = vi.fn().mockResolvedValue(undefined);
    const db = {
      select: vi
        .fn()
        .mockImplementationOnce(() =>
          selectResult([
            {
              fileType: 'custom/folder',
              id: 'docs_parent',
              parentId: null,
              spaceId: 'spc_test',
            },
          ]),
        )
        .mockImplementationOnce(() => selectResult([{ parentId: null }])),
    } as any;

    const guard = new TreeGuard(db, 'user-1') as any;
    guard.authorizer = { assertCapability };

    await expect(
      guard.assertParentAssignment({
        currentSpaceId: 'spc_test',
        itemId: 'docs_item',
        parentId: 'docs_parent',
      }),
    ).resolves.toBeUndefined();

    expect(assertCapability).toHaveBeenCalledWith({
      capability: 'create_child',
      id: 'docs_parent',
      kind: 'document',
    });
  });
});
