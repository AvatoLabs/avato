import { isDesktop } from '@lobechat/const';
import {
  type UserInitializationState,
  type UserPreference,
  type UserSettings,
} from '@lobechat/types';
import {
  Plans,
  UserGuideSchema,
  UserOnboardingSchema,
  UserPreferenceSchema,
  UserSettingsSchema,
} from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { after } from 'next/server';
import { z } from 'zod';

import { getReferralStatus, getSubscriptionPlan } from '@/business/server/user';
import { MessageModel } from '@/database/models/message';
import { SessionModel } from '@/database/models/session';
import { SpaceModel } from '@/database/models/space';
import { UserModel } from '@/database/models/user';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { FileService } from '@/server/services/file';
import {
  buildLegacyUserAvatarStorageKey,
  buildUserAvatarRoute,
  buildUserAvatarStorageKey,
  parseUserAvatarFileNameFromRoute,
} from '@/server/services/user/avatar';

const usernameSchema = z
  .string()
  .trim()
  .min(1, { message: 'USERNAME_REQUIRED' })
  .max(64, { message: 'USERNAME_TOO_LONG' })
  .regex(/^\w+$/, { message: 'USERNAME_INVALID' });

const userProcedure = authedProcedure.use(serverDatabase).use(async ({ ctx, next }) => {
  return next({
    ctx: {
      fileService: new FileService(ctx.serverDB, ctx.userId),
      messageModel: new MessageModel(ctx.serverDB, ctx.userId),
      sessionModel: new SessionModel(ctx.serverDB, ctx.userId),
      spaceModel: new SpaceModel(ctx.serverDB, ctx.userId),
      userModel: new UserModel(ctx.serverDB, ctx.userId),
    },
  });
});

export const userRouter = router({
  getUserRegistrationDuration: userProcedure.query(async ({ ctx }) => {
    return ctx.userModel.getUserRegistrationDuration();
  }),

  getUserSSOProviders: userProcedure.query(async ({ ctx }) => {
    return ctx.userModel.getUserSSOProviders();
  }),

  getUserState: userProcedure.query(async ({ ctx }): Promise<UserInitializationState> => {
    try {
      after(async () => {
        try {
          await ctx.userModel.updateUser({ lastActiveAt: new Date() });
        } catch (err) {
          console.error('update lastActiveAt failed, error:', err);
        }
      });
    } catch {
      // `after` may fail outside request scope (e.g., in tests), ignore silently
    }

    // For desktop mode or NoAuth mode, ensure user exists before getting state
    if (isDesktop || process.env.NOAUTH_MODE === '1') {
      await UserModel.makeSureUserExist(ctx.serverDB, ctx.userId);
    }

    // Run user state fetch and count queries in parallel
    const [state, messageCount, hasExtraSession, referralStatus, subscriptionPlan] =
      await Promise.all([
        ctx.userModel.getUserState(KeyVaultsGateKeeper.getUserKeyVaults),
        ctx.messageModel.countUpTo(5),
        ctx.sessionModel.hasMoreThanN(1),
        getReferralStatus(ctx.userId),
        getSubscriptionPlan(ctx.userId),
      ]);

    const hasMoreThan4Messages = messageCount > 4;
    const hasAnyMessages = messageCount > 0;
    return {
      avatar: state.avatar,
      canEnablePWAGuide: hasMoreThan4Messages,
      canEnableTrace: hasMoreThan4Messages,
      email: state.email,
      firstName: state.firstName,
      fullName: state.fullName,

      // Has conversation if there are messages or has created any assistant
      hasConversation: hasAnyMessages || hasExtraSession,

      interests: state.interests,

      lastName: state.lastName,
      onboarding: state.onboarding,
      preference: state.preference as UserPreference,
      settings: state.settings,
      userId: ctx.userId,
      username: state.username,

      // business features
      referralStatus,
      subscriptionPlan,
      isFreePlan: !subscriptionPlan || subscriptionPlan === Plans.Free,
    } satisfies UserInitializationState;
  }),

  makeUserOnboarded: userProcedure.mutation(async ({ ctx }) => {
    return ctx.userModel.updateUser({ isOnboarded: true });
  }),

  resetSettings: userProcedure.mutation(async ({ ctx }) => {
    return ctx.userModel.deleteSetting();
  }),

  updateAvatar: userProcedure.input(z.string()).mutation(async ({ ctx, input }) => {
    const removeOldAvatar = async (nextAvatar?: string) => {
      const userState = await ctx.userModel.getUserState(KeyVaultsGateKeeper.getUserKeyVaults);
      const oldAvatarUrl = userState.avatar;
      if (!oldAvatarUrl || !oldAvatarUrl.startsWith('/webapi/') || oldAvatarUrl === nextAvatar) {
        return;
      }

      const oldFilePaths = new Set<string>();
      const oldAvatarFileName = parseUserAvatarFileNameFromRoute(oldAvatarUrl, ctx.userId);
      if (oldAvatarFileName) {
        const personalSpace = await ctx.spaceModel.getOrCreatePersonalSpace();
        oldFilePaths.add(buildUserAvatarStorageKey(personalSpace.id, oldAvatarFileName));
        oldFilePaths.add(buildLegacyUserAvatarStorageKey(ctx.userId, oldAvatarFileName));
      } else {
        oldFilePaths.add(oldAvatarUrl.replace('/webapi/', ''));
      }

      try {
        await Promise.all(
          [...oldFilePaths].map(async (oldFilePath) => {
            try {
              await ctx.fileService.deleteFile(oldFilePath);
            } catch {
              // best-effort cleanup; avatar update should not fail because deletion failed
            }
          }),
        );
      } catch {
        // best-effort cleanup; avatar update should not fail because deletion failed
      }
    };

    // If it's Base64 data, need to upload to S3
    if (input.startsWith('data:image')) {
      try {
        // Extract mimeType, e.g., "image/png"
        const prefix = 'data:';
        const semicolonIndex = input.indexOf(';');
        const mimeType =
          semicolonIndex !== -1 ? input.slice(prefix.length, semicolonIndex) : 'image/png';
        const fileType = mimeType.split('/')[1];

        // Split string to get the Base64 part
        const commaIndex = input.indexOf(',');
        if (commaIndex === -1) {
          throw new Error('Invalid Base64 data');
        }
        const base64Data = input.slice(commaIndex + 1);

        // Use UUID to generate unique filename to prevent caching issues
        const { key: filePath } = await ctx.fileService.createOpaqueUserBlobPath(
          'user-avatar',
          fileType,
        );
        const fileName = filePath.split('/').pop();
        if (!fileName) {
          throw new Error('Invalid avatar storage key');
        }

        // Convert Base64 data to Buffer and upload to S3
        const buffer = Buffer.from(base64Data, 'base64');

        await ctx.fileService.uploadBuffer(filePath, buffer, mimeType);

        const avatarUrl = buildUserAvatarRoute(ctx.userId, fileName);
        await removeOldAvatar(avatarUrl);

        return ctx.userModel.updateUser({ avatar: avatarUrl });
      } catch (error) {
        throw new Error(
          'Error uploading avatar: ' + (error instanceof Error ? error.message : String(error)),
          { cause: error },
        );
      }
    }

    // If it's not Base64 data, directly use URL to update user avatar
    await removeOldAvatar(input);
    return ctx.userModel.updateUser({ avatar: input });
  }),

  updateFullName: userProcedure
    .input(z.string().trim().max(64, { message: 'FULLNAME_TOO_LONG' }))
    .mutation(async ({ ctx, input }) => {
      return ctx.userModel.updateUser({ fullName: input });
    }),

  updateGuide: userProcedure.input(UserGuideSchema).mutation(async ({ ctx, input }) => {
    return ctx.userModel.updateGuide(input);
  }),

  updateInterests: userProcedure.input(z.array(z.string())).mutation(async ({ ctx, input }) => {
    return ctx.userModel.updateUser({ interests: input });
  }),

  updateOnboarding: userProcedure.input(UserOnboardingSchema).mutation(async ({ ctx, input }) => {
    return ctx.userModel.updateUser({ onboarding: input });
  }),

  updatePreference: userProcedure.input(UserPreferenceSchema).mutation(async ({ ctx, input }) => {
    return ctx.userModel.updatePreference(input);
  }),

  updateSettings: userProcedure.input(UserSettingsSchema).mutation(async ({ ctx, input }) => {
    const { keyVaults, ...res } = input as Partial<UserSettings>;

    // Encrypt keyVaults
    let encryptedKeyVaults: string | null = null;

    if (keyVaults) {
      // TODO: better to add a validation
      const data = JSON.stringify(keyVaults);
      const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();

      encryptedKeyVaults = await gateKeeper.encrypt(data);
    }

    const nextValue = { ...res, keyVaults: encryptedKeyVaults };

    return ctx.userModel.updateSetting(nextValue);
  }),

  updateUsername: userProcedure.input(usernameSchema).mutation(async ({ ctx, input }) => {
    const existedUser = await UserModel.findByUsername(ctx.serverDB, input);
    if (existedUser && existedUser.id !== ctx.userId) {
      throw new TRPCError({ code: 'CONFLICT', message: 'USERNAME_TAKEN' });
    }

    return ctx.userModel.updateUser({ username: input });
  }),

  lookupUserByUsername: userProcedure
    .input(z.object({ username: z.string().trim().min(1) }))
    .query(async ({ ctx, input }) => {
      const user = await UserModel.findByUsername(ctx.serverDB, input.username);
      if (!user?.id) return null;

      return {
        avatar: user.avatar,
        fullName: user.fullName,
        id: user.id,
        username: user.username,
      };
    }),

  searchUsers: userProcedure
    .input(
      z.object({
        keyword: z.string().trim().min(1),
        limit: z.number().int().min(1).max(10).default(8),
      }),
    )
    .query(async ({ ctx, input }) => {
      return UserModel.searchByKeyword(ctx.serverDB, input.keyword, { limit: input.limit });
    }),
});

export type UserRouter = typeof userRouter;
