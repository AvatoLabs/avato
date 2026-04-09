// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageModel } from '@/database/models/message';
import { SessionModel } from '@/database/models/session';
import { SpaceModel } from '@/database/models/space';
import { UserModel } from '@/database/models/user';
import { serverDB } from '@/database/server';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { FileService } from '@/server/services/file';

import { userRouter } from '../user';

// Mock modules
vi.mock('@/database/server', () => ({
  serverDB: {},
}));

vi.mock('@/database/models/message');
vi.mock('@/database/models/session');
vi.mock('@/database/models/space');
vi.mock('@/database/models/user');
vi.mock('@/server/modules/KeyVaultsEncrypt');
vi.mock('@/server/modules/S3');
vi.mock('@/server/services/file');
vi.mock('@/server/services/user');

describe('userRouter', () => {
  const mockUserId = 'test-user-id';
  const mockCtx = {
    userId: mockUserId,
  };
  const mockUploadBuffer = vi.fn();
  const mockDeleteFile = vi.fn();
  const mockCreateOpaqueUserBlobPath = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(FileService).mockImplementation(
      () =>
        ({
          createOpaqueUserBlobPath: mockCreateOpaqueUserBlobPath,
          deleteFile: mockDeleteFile,
          uploadBuffer: mockUploadBuffer,
        }) as any,
    );
    vi.mocked(SpaceModel).mockImplementation(
      () =>
        ({
          getOrCreatePersonalSpace: vi.fn().mockResolvedValue({ id: 'spc_personal' }),
        }) as any,
    );
    mockUploadBuffer.mockResolvedValue(undefined);
    mockDeleteFile.mockResolvedValue(undefined);
    mockCreateOpaqueUserBlobPath.mockResolvedValue({
      key: 'v2/spaces/spc_personal/blobs/user-avatar/avatar-1.webp',
      spaceId: 'spc_personal',
    });
  });

  describe('getUserRegistrationDuration', () => {
    it('should return registration duration', async () => {
      const mockDuration = { duration: 100, createdAt: '2023-01-01', updatedAt: '2023-01-02' };
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            getUserRegistrationDuration: vi.fn().mockResolvedValue(mockDuration),
          }) as any,
      );

      const result = await userRouter.createCaller({ ...mockCtx }).getUserRegistrationDuration();

      expect(result).toEqual(mockDuration);
      expect(UserModel).toHaveBeenCalledWith(serverDB, mockUserId);
    });
  });

  describe('getUserSSOProviders', () => {
    it('should return SSO providers', async () => {
      const mockProviders = [
        {
          provider: 'google',
          providerAccountId: '123',
          userId: 'user-1',
          type: 'oauth',
        },
      ];
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            getUserSSOProviders: vi.fn().mockResolvedValue(mockProviders),
          }) as any,
      );

      const result = await userRouter.createCaller({ ...mockCtx }).getUserSSOProviders();

      expect(result).toEqual(mockProviders);
      expect(UserModel).toHaveBeenCalledWith(serverDB, mockUserId);
    });
  });

  describe('getUserState', () => {
    it('should return user state', async () => {
      const mockState = {
        isOnboarded: true,
        preference: { telemetry: true },
        settings: {},
        userId: mockUserId,
      };

      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            getUserState: vi.fn().mockResolvedValue(mockState),
            updateUser: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }) as any,
      );

      vi.mocked(MessageModel).mockImplementation(
        () =>
          ({
            countUpTo: vi.fn().mockResolvedValue(5),
          }) as any,
      );

      vi.mocked(SessionModel).mockImplementation(
        () =>
          ({
            hasMoreThanN: vi.fn().mockResolvedValue(true),
          }) as any,
      );

      const result = await userRouter.createCaller({ ...mockCtx }).getUserState();

      expect(result).toMatchObject({
        preference: { telemetry: true },
        settings: {},
        hasConversation: true,
        canEnablePWAGuide: true,
        canEnableTrace: true,
        userId: mockUserId,
      });
    });
  });

  describe('makeUserOnboarded', () => {
    it('should update user onboarded status', async () => {
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateUser: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).makeUserOnboarded();

      expect(UserModel).toHaveBeenCalledWith(serverDB, mockUserId);
    });
  });

  describe('updateSettings', () => {
    it('should update settings with encrypted key vaults', async () => {
      const mockSettings = {
        keyVaults: { openai: { key: 'test-key' } },
        general: { language: 'en-US' },
      };

      const mockEncryptedVaults = 'encrypted-data';
      const mockGateKeeper = {
        encrypt: vi.fn().mockResolvedValue(mockEncryptedVaults),
      };

      vi.mocked(KeyVaultsGateKeeper.initWithEnvKey).mockResolvedValue(mockGateKeeper as any);
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateSetting: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).updateSettings(mockSettings);

      expect(mockGateKeeper.encrypt).toHaveBeenCalledWith(JSON.stringify(mockSettings.keyVaults));
    });

    it('should update settings without key vaults', async () => {
      const mockSettings = {
        general: { language: 'en-US' },
      };

      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            updateSetting: vi.fn().mockResolvedValue({ rowCount: 1 }),
          }) as any,
      );

      await userRouter.createCaller({ ...mockCtx }).updateSettings(mockSettings);

      expect(UserModel).toHaveBeenCalledWith(serverDB, mockUserId);
    });
  });

  describe('updateAvatar', () => {
    it('should upload base64 avatars under the opaque user-avatar scope and update route url', async () => {
      const mockGetUserState = vi.fn().mockResolvedValue({
        avatar: '/webapi/user/avatar/test-user-id/old-avatar.webp',
      });
      const mockUpdateUser = vi.fn().mockResolvedValue({ rowCount: 1 });
      vi.mocked(UserModel).mockImplementation(
        () =>
          ({
            getUserState: mockGetUserState,
            updateUser: mockUpdateUser,
          }) as any,
      );

      const base64 =
        'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBYAAAAwAQCdASoQABAAPm0skkqkIyIhKAgAgA2JaQB2APwA';
      await userRouter.createCaller({ ...mockCtx }).updateAvatar(base64);

      expect(mockCreateOpaqueUserBlobPath).toHaveBeenCalledWith('user-avatar', 'webp');
      expect(mockUploadBuffer).toHaveBeenCalledWith(
        'v2/spaces/spc_personal/blobs/user-avatar/avatar-1.webp',
        expect.any(Buffer),
        'image/webp',
      );
      expect(mockDeleteFile).toHaveBeenCalledWith(
        'v2/spaces/spc_personal/blobs/user-avatar/old-avatar.webp',
      );
      expect(mockDeleteFile).toHaveBeenCalledWith('user/avatar/test-user-id/old-avatar.webp');
      expect(mockUpdateUser).toHaveBeenCalledWith({
        avatar: '/webapi/user/avatar/test-user-id/avatar-1.webp',
      });
    });
  });
});
