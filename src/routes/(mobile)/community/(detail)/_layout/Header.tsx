'use client';

import { ChatHeader } from '@lobehub/ui/mobile';
import { memo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { mobileHeaderSticky } from '@/styles/mobileHeader';

const TYPES_WITH_LIST_PAGE = ['agent', 'model', 'provider', 'mcp', 'plugin', 'skill'];

export const getCommunityDetailBackPath = (pathname: string) => {
  const [, detailType] = pathname.split('/').filter(Boolean);

  if (detailType === 'group_agent') return '/community/agent';
  if (detailType && TYPES_WITH_LIST_PAGE.includes(detailType)) return `/community/${detailType}`;

  return '/community';
};

const Header = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <ChatHeader
      showBackButton
      style={mobileHeaderSticky}
      onBackClick={() => navigate(getCommunityDetailBackPath(location.pathname))}
    />
  );
});

export default Header;
