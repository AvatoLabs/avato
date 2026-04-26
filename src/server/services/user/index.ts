import { ENABLE_BUSINESS_FEATURES } from '@lobechat/business-const';
import { type LobeChatDatabase } from '@lobechat/database';

import { initNewUserForBusiness } from '@/business/server/user';
import { SpaceModel } from '@/database/models/space';
import { UserModel } from '@/database/models/user';
import { initializeServerAnalytics } from '@/libs/analytics';
import { getBlobProvider } from '@/server/modules/BlobProvider';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';

import { buildLegacyUserAvatarStorageKey, buildUserAvatarStorageKey } from './avatar';

type CreatedUser = {
  createdAt?: Date | null;
  email?: string | null;
  firstName?: string | null;
  id: string;
  lastName?: string | null;
  phone?: string | null;
  username?: string | null;
};

export class UserService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  async initUser(user: CreatedUser) {
    if (ENABLE_BUSINESS_FEATURES) {
      try {
        await initNewUserForBusiness(user.id, user.createdAt);
      } catch (error) {
        console.error(error);
        console.error('Failed to init new user for business');
      }
    }

    const analytics = await initializeServerAnalytics();
    analytics?.identify(user.id, {
      email: user.email ?? undefined,
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
      phone: user.phone ?? undefined,
      username: user.username ?? undefined,
    });
    analytics?.track({
      name: 'user_register_completed',
      properties: {
        spm: 'user_service.init_user.user_created',
      },
      userId: user.id,
    });
  }

  getUserApiKeys = async (id: string) => {
    return UserModel.getUserApiKeys(this.db, id, KeyVaultsGateKeeper.getUserKeyVaults);
  };

  getUserAvatar = async (id: string, image: string) => {
    const personalSpace = await SpaceModel.findPersonalSpaceByOwnerId(this.db, id);
    const candidateKeys = [
      personalSpace?.id ? buildUserAvatarStorageKey(personalSpace.id, image) : undefined,
      buildLegacyUserAvatarStorageKey(id, image),
    ].filter(Boolean) as string[];

    for (const key of candidateKeys) {
      try {
        const file = await getBlobProvider().getObjectByteArray(key);
        if (file) {
          return Buffer.from(file);
        }
      } catch (error) {
        console.error('Failed to get user avatar', error);
      }
    }

    return null;
  };
}
