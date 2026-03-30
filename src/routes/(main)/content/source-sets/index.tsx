'use client';

import { memo, useLayoutEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import NotFound from '@/components/404';
import NProgress from '@/components/NProgress';
import ContentManager from '@/features/ContentManager';
import { buildSourceSetPath } from '@/features/ResourceSpaces';
import Container from '@/routes/(main)/content/source-sets/features/Container';

import { useInitFileCheck } from '../features/hooks/useInitFileCheck';
import { useSourceSetItem } from '../features/hooks/useSourceSetItem';
import { useContentManagerStore } from '../features/store';

const MainContent = memo(() => {
  const { id: sourceSetId, spaceId } = useParams<{ id: string; spaceId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [setSourceSetId, setSpaceId] = useContentManagerStore((s) => [
    s.setSourceSetId,
    s.setSpaceId,
  ]);

  // Load source-set data.
  const { data, isLoading } = useSourceSetItem(sourceSetId || '');

  // Sync sourceSetId from URL params using useLayoutEffect
  // useLayoutEffect runs synchronously before browser paint, ensuring state is set
  // before Explorer component renders and computes query parameters
  // IMPORTANT: Only depend on sourceSetId and location.pathname, NOT currentSourceSetId to avoid feedback loop
  useLayoutEffect(() => {
    const isOnSourceSetRoute = location.pathname.includes('/source-sets/');
    if (isOnSourceSetRoute) {
      setSourceSetId(sourceSetId);
      setSpaceId(spaceId || data?.spaceId || undefined);
    }
  }, [data?.spaceId, sourceSetId, location.pathname, setSourceSetId, setSpaceId, spaceId]);

  useLayoutEffect(() => {
    if (!sourceSetId) return;

    if (!spaceId && data?.spaceId) {
      navigate(buildSourceSetPath(data.spaceId, sourceSetId), { replace: true });
    }
  }, [data?.spaceId, sourceSetId, navigate, spaceId]);

  // Sync file view mode from URL
  useInitFileCheck();

  if (!isLoading && !data) return <NotFound />;

  return <ContentManager />;
});

MainContent.displayName = 'SourceSetMainContent';

const SourceSetPage = memo(() => {
  return (
    <>
      <NProgress />
      <Container>
        <MainContent />
      </Container>
    </>
  );
});

SourceSetPage.displayName = 'SourceSetPage';

export default SourceSetPage;
