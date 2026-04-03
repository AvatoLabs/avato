'use client';

import { memo, useLayoutEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import NotFound from '@/components/404';
import NProgress from '@/components/NProgress';
import ContentManager from '@/features/ContentManager';
import { buildSourceSetPath } from '@/features/ResourceSpaces';
import { FilesTabs } from '@/types/files';

import { useInitFileCheck } from '../features/hooks/useInitFileCheck';
import { useSourceSetItem } from '../features/hooks/useSourceSetItem';
import { useContentManagerStore } from '../features/store';

const SourceSetPage = memo(() => {
  const { id: sourceSetId, spaceId } = useParams<{ id: string; spaceId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [setCategory, setSourceSetId, setSpaceId] = useContentManagerStore((s) => [
    s.setCategory,
    s.setSourceSetId,
    s.setSpaceId,
  ]);

  const { data, isLoading } = useSourceSetItem(sourceSetId || '');

  useLayoutEffect(() => {
    const isOnSourceSetRoute = location.pathname.includes('/source-sets/');
    if (!isOnSourceSetRoute) return;

    setCategory(FilesTabs.Home);
    setSourceSetId(sourceSetId);
    setSpaceId(spaceId || data?.spaceId || undefined);
  }, [
    data?.spaceId,
    location.pathname,
    setCategory,
    setSourceSetId,
    setSpaceId,
    sourceSetId,
    spaceId,
  ]);

  useLayoutEffect(() => {
    if (!sourceSetId || spaceId || !data?.spaceId) return;

    navigate(buildSourceSetPath(data.spaceId, sourceSetId), { replace: true });
  }, [data?.spaceId, navigate, sourceSetId, spaceId]);

  useInitFileCheck();

  if (!isLoading && !data) return <NotFound />;

  return (
    <>
      <NProgress />
      <ContentManager />
    </>
  );
});

SourceSetPage.displayName = 'SourceSetPage';

export default SourceSetPage;
