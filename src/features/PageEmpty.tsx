import { type EmptyProps } from '@lobehub/ui';
import { Button, Center, Empty } from '@lobehub/ui';
import { FileText, Table2 } from 'lucide-react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';

import { SPACE_LIST_KEY } from '@/features/ResourceSpaces/SpaceList';
import { buildSpaceMemoryPath } from '@/features/ResourceSpaces/paths';
import {
  buildPendingGovernancePath,
  canReviewSpaceMemorySummary,
  useTeamSpaceMemoryScopeSummaries,
} from '@/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries';
import { lambdaClient } from '@/libs/trpc/client';
import { DEFAULT_PAGE_KIND, type PageKind, TABLE_PAGE_KIND } from '@/utils/docs';

interface PageEmptyProps extends Omit<EmptyProps, 'icon'> {
  pageKind?: PageKind;
  search?: boolean;
}

const PageEmpty = memo<PageEmptyProps>(({ pageKind = DEFAULT_PAGE_KIND, search, ...rest }) => {
  const { t } = useTranslation('file');
  const navigate = useNavigate();
  const { spaceId } = useParams<{ spaceId?: string }>();
  const isTablePage = pageKind === TABLE_PAGE_KIND;
  const { data: spaces } = useSWR(
    spaceId ? SPACE_LIST_KEY : null,
    () => lambdaClient.space.listSpaces.query(),
    {
      revalidateOnFocus: false,
    },
  );
  const currentSpace = spaces?.find((space) => space.id === spaceId);
  const { pendingGovernanceCountBySpaceId, pendingGovernanceTargetBySpaceId, spaceSummaryMap } =
    useTeamSpaceMemoryScopeSummaries(currentSpace ? [currentSpace] : undefined);
  const spaceMemorySummary = spaceId ? spaceSummaryMap.get(spaceId) : undefined;
  const canReviewSpaceMemory = canReviewSpaceMemorySummary(spaceMemorySummary);
  const pendingCount = spaceId ? (pendingGovernanceCountBySpaceId.get(spaceId) ?? 0) : 0;
  const pendingTarget = spaceId ? (pendingGovernanceTargetBySpaceId.get(spaceId) ?? null) : null;
  const showReviewAction =
    !search && currentSpace?.kind === 'team' && canReviewSpaceMemory && pendingCount > 0 && !!pendingTarget;
  const showOpenAction =
    !search && currentSpace?.kind === 'team' && !!spaceMemorySummary && !canReviewSpaceMemory;

  return (
    <Center height="100%" style={{ minHeight: '50vh' }} width="100%">
      <Empty
        action={
          showReviewAction ? (
            <Button
              onClick={() => navigate(buildPendingGovernancePath(currentSpace.id, pendingTarget))}
            >
              {t('space.home.recall.actions.review', { count: pendingCount })}
            </Button>
          ) : showOpenAction ? (
            <Button onClick={() => navigate(buildSpaceMemoryPath(currentSpace!.id))}>
              {t('space.home.recall.actions.open')}
            </Button>
          ) : undefined
        }
        icon={isTablePage ? Table2 : FileText}
        description={
          search
            ? t(isTablePage ? 'pageList.tableNoResults' : 'pageList.noResults')
            : t(isTablePage ? 'pageList.tableEmpty' : 'pageList.empty')
        }
        descriptionProps={{
          fontSize: 14,
        }}
        style={{
          maxWidth: 400,
        }}
        {...rest}
      />
    </Center>
  );
});

PageEmpty.displayName = 'PageEmpty';

export default PageEmpty;
