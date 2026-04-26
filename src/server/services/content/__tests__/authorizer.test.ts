// @vitest-environment node
import type { TRPCError } from '@trpc/server';
import { describe, expect, it, vi } from 'vitest';

import { ContentAuthorizer } from '../index';

const createAuthorizer = () => new ContentAuthorizer({} as any, 'user-1') as any;

describe('ContentAuthorizer', () => {
  it('allows sharing delegation for space owners and admins', async () => {
    const ownerAuthorizer = createAuthorizer();
    ownerAuthorizer.resolveByUid = vi.fn().mockResolvedValue({
      contentUid: 'cnt_1',
      spaceId: 'spc_1',
    });
    ownerAuthorizer.getBestPermission = vi.fn().mockResolvedValue({
      canAccess: true,
      matchedBy: 'space_member',
    });
    ownerAuthorizer.getSpaceRole = vi.fn().mockResolvedValue('owner');

    await expect(ownerAuthorizer.assertCanDelegateSharing('cnt_1')).resolves.toBeUndefined();

    const adminAuthorizer = createAuthorizer();
    adminAuthorizer.resolveByUid = vi.fn().mockResolvedValue({
      contentUid: 'cnt_1',
      spaceId: 'spc_1',
    });
    adminAuthorizer.getBestPermission = vi.fn().mockResolvedValue({
      canAccess: true,
      matchedBy: 'space_member',
    });
    adminAuthorizer.getSpaceRole = vi.fn().mockResolvedValue('admin');

    await expect(adminAuthorizer.assertCanDelegateSharing('cnt_1')).resolves.toBeUndefined();
  });

  it('rejects space editors without a direct or inherited resharing grant', async () => {
    const authorizer = createAuthorizer();
    authorizer.resolveByUid = vi.fn().mockResolvedValue({
      contentUid: 'cnt_1',
      spaceId: 'spc_1',
    });
    authorizer.getBestPermission = vi.fn().mockResolvedValue({
      canAccess: true,
      matchedBy: 'space_member',
    });
    authorizer.getSpaceRole = vi.fn().mockResolvedValue('editor');
    authorizer.getDirectPermissionForUser = vi.fn().mockResolvedValue(null);
    authorizer.resolveInheritedShareDelegatingGrant = vi.fn().mockResolvedValue(null);

    await expect(authorizer.assertCanDelegateSharing('cnt_1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'RESOURCE_RESHARE_DENIED',
    } satisfies Partial<TRPCError>);
  });

  it('allows direct editors only when canReshare is enabled', async () => {
    const authorizer = createAuthorizer();
    authorizer.resolveByUid = vi.fn().mockResolvedValue({
      contentUid: 'cnt_1',
      spaceId: 'spc_1',
    });
    authorizer.getBestPermission = vi.fn().mockResolvedValue({
      canAccess: true,
      matchedBy: 'direct',
    });
    authorizer.getSpaceRole = vi.fn().mockResolvedValue('viewer');
    authorizer.getDirectPermissionForUser = vi.fn().mockResolvedValue({
      canReshare: true,
      role: 'editor',
    });

    await expect(authorizer.assertCanDelegateSharing('cnt_1')).resolves.toBeUndefined();

    authorizer.getDirectPermissionForUser = vi.fn().mockResolvedValue({
      canReshare: false,
      role: 'editor',
    });

    await expect(authorizer.assertCanDelegateSharing('cnt_1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'RESOURCE_RESHARE_DENIED',
    } satisfies Partial<TRPCError>);
  });

  it('applies the same resharing rule to inherited editor grants', async () => {
    const authorizer = createAuthorizer();
    authorizer.resolveByUid = vi.fn().mockResolvedValue({
      contentUid: 'cnt_1',
      spaceId: 'spc_1',
    });
    authorizer.getBestPermission = vi.fn().mockResolvedValue({
      canAccess: true,
      matchedBy: 'inherited',
    });
    authorizer.getSpaceRole = vi.fn().mockResolvedValue('viewer');
    authorizer.resolveInheritedShareDelegatingGrant = vi.fn().mockResolvedValue({
      canReshare: false,
      role: 'editor',
    });

    await expect(authorizer.assertCanDelegateSharing('cnt_1')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'RESOURCE_RESHARE_DENIED',
    } satisfies Partial<TRPCError>);

    authorizer.resolveInheritedShareDelegatingGrant = vi.fn().mockResolvedValue({
      canReshare: true,
      role: 'editor',
    });

    await expect(authorizer.assertCanDelegateSharing('cnt_1')).resolves.toBeUndefined();
  });
});
