'use client';

import { Avatar, Skeleton } from '@lobehub/ui';
import { memo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

import { useMarketAuth, useMarketUserProfile } from '@/layout/AuthProvider/MarketAuth';
import { useServerConfigStore } from '@/store/serverConfig';
import { serverConfigSelectors } from '@/store/serverConfig/selectors';

/**
 * 检查用户是否需要完善资料
 * 当使用 trustedClient 自动授权时，用户的 meta 相关字段会为空
 */
const checkNeedsProfileSetup = (
  enableMarketTrustedClient: boolean,
  userProfile:
    | {
        avatarUrl: string | null;
        bannerUrl: string | null;
        socialLinks: { github?: string; twitter?: string; website?: string } | null;
      }
    | null
    | undefined,
): boolean => {
  if (!enableMarketTrustedClient) return false;
  if (!userProfile) return true;

  // 如果 avatarUrl 字段为空，则需要完善资料
  const hasAvatarUrl = !!userProfile.avatarUrl;

  return !hasAvatarUrl;
};

const UserAvatar = memo(() => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, getCurrentUserInfo } = useMarketAuth();

  const enableMarketTrustedClient = useServerConfigStore(
    serverConfigSelectors.enableMarketTrustedClient,
  );

  const userInfo = getCurrentUserInfo();
  const username = userInfo?.sub;

  // Use SWR to fetch user profile with caching
  const { data: userProfile } = useMarketUserProfile(username);

  // 检查是否需要完善资料
  const needsProfileSetup = checkNeedsProfileSetup(enableMarketTrustedClient, userProfile);

  const handleAvatarClick = useCallback(() => {
    const profileUserName = userProfile?.userName || userProfile?.namespace;
    if (profileUserName) {
      navigate(`/community/user/${profileUserName}`);
    }
  }, [navigate, userProfile?.userName, userProfile?.namespace]);

  if (isLoading) {
    return <Skeleton.Avatar active shape={'square'} size={28} style={{ borderRadius: 6 }} />;
  }

  // 社区入口不再显示创作者招募/登录按钮，未登录时直接隐藏。
  if (!enableMarketTrustedClient && (!isAuthenticated || needsProfileSetup)) {
    return null;
  }

  // Get avatar from user profile (fetched via SWR with caching)
  const avatarUrl = userProfile?.avatarUrl;

  return (
    <Avatar
      avatar={avatarUrl || userProfile?.userName || username}
      shape={'square'}
      size={28}
      onClick={handleAvatarClick}
    />
  );
});

export default UserAvatar;
