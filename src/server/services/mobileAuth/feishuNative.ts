import { createNanoId, idGenerator, type LobeChatDatabase } from '@lobechat/database';
import { and, eq } from 'drizzle-orm';

import { UserModel } from '@/database/models/user';
import { account } from '@/database/schemas/betterAuth';
import { users } from '@/database/schemas/user';
import { authEnv } from '@/envs/auth';
import { createMobileTokenPair, verifyMobileRefreshToken } from '@/libs/oidc-provider/mobileJwt';
import { UserService } from '@/server/services/user';

const FEISHU_PROVIDER_ID = 'feishu';
const FEISHU_TOKEN_URL = 'https://open.feishu.cn/open-apis/authen/v2/oauth/token';
const FEISHU_USERINFO_URL = 'https://open.feishu.cn/open-apis/authen/v1/user_info';
const MOBILE_USER_ID_SIZE = 32 - 'user_'.length;

interface FeishuNativeTokenResponse {
  access_token?: string;
  code?: number;
  data?: {
    access_token?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  error?: string;
  error_description?: string;
  expires_in?: number;
  message?: string;
  msg?: string;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
}

interface FeishuNativeUserInfoResponse {
  code?: number;
  data?: {
    avatar_big?: string;
    avatar_middle?: string;
    avatar_thumb?: string;
    avatar_url?: string;
    email?: string;
    en_name?: string;
    enterprise_email?: string;
    name?: string;
    open_id?: string;
    union_id?: string;
  };
  msg?: string;
}

type FeishuNativeUserProfile = NonNullable<FeishuNativeUserInfoResponse['data']>;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const resolveProfileEmail = (profile: FeishuNativeUserProfile) => {
  const unionId = profile.union_id ?? profile.open_id;

  if (!unionId) {
    throw new Error('Feishu user profile is missing both union_id and open_id.');
  }

  return normalizeEmail(
    profile.email || profile.enterprise_email || `${unionId}@feishu.sso`,
  );
};

const resolveProfileImage = (profile: FeishuNativeUserProfile) =>
  profile.avatar_url ?? profile.avatar_thumb ?? profile.avatar_middle ?? profile.avatar_big;

export class FeishuNativeMobileAuthService {
  constructor(private db: LobeChatDatabase) {}

  private ensureFeishuConfig() {
    if (!authEnv.AUTH_FEISHU_APP_ID || !authEnv.AUTH_FEISHU_APP_SECRET) {
      throw new Error('Feishu SSO is not configured on the server.');
    }

    return {
      clientId: authEnv.AUTH_FEISHU_APP_ID,
      clientSecret: authEnv.AUTH_FEISHU_APP_SECRET,
    };
  }

  private async fetchFeishuToken(params: { code: string; codeVerifier?: string }) {
    const { clientId, clientSecret } = this.ensureFeishuConfig();

    const response = await fetch(FEISHU_TOKEN_URL, {
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        ...(params.codeVerifier ? { code_verifier: params.codeVerifier } : {}),
        code: params.code,
        grant_type: 'authorization_code',
      }),
      cache: 'no-store',
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      method: 'POST',
    });

    const parsed = (await response.json()) as FeishuNativeTokenResponse;
    const payload = parsed.data ?? parsed;

    if (!response.ok || (typeof parsed.code === 'number' && parsed.code !== 0) || !payload.access_token) {
      throw new Error(
        parsed.error_description || parsed.msg || parsed.message || 'Failed to exchange Feishu authorization code.',
      );
    }

    return {
      accessToken: payload.access_token,
      accessTokenExpiresAt: payload.expires_in
        ? new Date(Date.now() + payload.expires_in * 1000)
        : undefined,
      refreshToken: payload.refresh_token,
      refreshTokenExpiresAt: payload.refresh_token_expires_in
        ? new Date(Date.now() + payload.refresh_token_expires_in * 1000)
        : undefined,
      scope: payload.scope,
      tokenType: payload.token_type || 'Bearer',
    };
  }

  private async fetchFeishuUserInfo(accessToken: string) {
    const response = await fetch(FEISHU_USERINFO_URL, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    const parsed = (await response.json()) as FeishuNativeUserInfoResponse;
    const profile = parsed.data;

    if (!response.ok || (typeof parsed.code === 'number' && parsed.code !== 0) || !profile) {
      throw new Error(parsed.msg || 'Failed to fetch Feishu user profile.');
    }

    return profile;
  }

  private async upsertLinkedAccount(params: {
    profile: FeishuNativeUserProfile;
    token: Awaited<ReturnType<FeishuNativeMobileAuthService['fetchFeishuToken']>>;
  }) {
    const accountId = params.profile.union_id ?? params.profile.open_id;

    if (!accountId) {
      throw new Error('Feishu user profile is missing account id.');
    }

    const email = resolveProfileEmail(params.profile);
    const image = resolveProfileImage(params.profile);
    const fullName = params.profile.name ?? params.profile.en_name ?? accountId;
    const now = new Date();

    const existingAccount = await this.db.query.account.findFirst({
      where: and(eq(account.providerId, FEISHU_PROVIDER_ID), eq(account.accountId, accountId)),
    });

    if (existingAccount) {
      await this.db
        .update(account)
        .set({
          accessToken: params.token.accessToken,
          accessTokenExpiresAt: params.token.accessTokenExpiresAt,
          refreshToken: params.token.refreshToken,
          refreshTokenExpiresAt: params.token.refreshTokenExpiresAt,
          scope: params.token.scope,
          updatedAt: now,
        })
        .where(eq(account.id, existingAccount.id));

      await new UserModel(this.db, existingAccount.userId).updateUser({
        avatar: image,
        fullName,
      });

      return existingAccount.userId;
    }

    let user = await UserModel.findByEmail(this.db, email);

    if (!user) {
      const createResult = await UserModel.createUser(this.db, {
        avatar: image,
        email,
        emailVerified: false,
        fullName,
        id: idGenerator('user', MOBILE_USER_ID_SIZE),
        normalizedEmail: email,
      });

      if (!createResult.user) {
        throw new Error('Failed to create user for Feishu mobile sign-in.');
      }

      user = createResult.user;
      await new UserService(this.db).initUser({
        createdAt: user.createdAt,
        email: user.email,
        id: user.id,
      });
    } else {
      await new UserModel(this.db, user.id).updateUser({
        avatar: image,
        fullName,
      });
    }

    await this.db.insert(account).values({
      accessToken: params.token.accessToken,
      accessTokenExpiresAt: params.token.accessTokenExpiresAt,
      accountId,
      id: createNanoId(12)(),
      providerId: FEISHU_PROVIDER_ID,
      refreshToken: params.token.refreshToken,
      refreshTokenExpiresAt: params.token.refreshTokenExpiresAt,
      scope: params.token.scope,
      updatedAt: now,
      userId: user.id,
    });

    return user.id;
  }

  exchangeCode = async (params: { code: string; codeVerifier?: string }) => {
    const token = await this.fetchFeishuToken(params);
    const profile = await this.fetchFeishuUserInfo(token.accessToken);
    const userId = await this.upsertLinkedAccount({ profile, token });

    return createMobileTokenPair(userId);
  };

  refreshSession = async (refreshToken: string) => {
    const userId = await verifyMobileRefreshToken(refreshToken);
    const user = await this.db.query.users.findFirst({
      columns: { id: true },
      where: eq(users.id, userId),
    });

    if (!user?.id) {
      throw new Error('User not found for mobile refresh.');
    }

    return createMobileTokenPair(user.id);
  };
}
