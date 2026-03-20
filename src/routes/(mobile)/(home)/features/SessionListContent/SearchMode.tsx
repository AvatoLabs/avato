import { useDebounce } from 'ahooks';
import { memo, useMemo } from 'react';

import { useServerConfigStore } from '@/store/serverConfig';
import { serverConfigSelectors } from '@/store/serverConfig/selectors';
import { useSessionStore } from '@/store/session';
import { type LobeAgentSession, type LobeSessions } from '@/types/session';
import { LobeSessionType } from '@/types/session';

import SkeletonList from '../SkeletonList';
import SessionList from './List';

const SESSION_SEARCH_DEBOUNCE = 250;

const SearchMode = memo(() => {
  const [sessionSearchKeywords, useSearchSessions] = useSessionStore((s) => [
    s.sessionSearchKeywords,
    s.useSearchSessions,
  ]);
  const debouncedKeywords = useDebounce(sessionSearchKeywords, { wait: SESSION_SEARCH_DEBOUNCE });

  const isMobile = useServerConfigStore(serverConfigSelectors.isMobile);

  const { data, isLoading } = useSearchSessions(debouncedKeywords);

  const filteredData = useMemo(() => {
    if (!data) return data;

    if (isMobile) {
      return data.filter((session: LobeSessions[0]) => session.type !== LobeSessionType.Group);
    }

    return data.filter(
      (session: LobeSessions[0]) =>
        session.type !== LobeSessionType.Agent || !(session as LobeAgentSession).config?.virtual,
    );
  }, [data, isMobile]);

  return isLoading || sessionSearchKeywords !== debouncedKeywords ? (
    <SkeletonList />
  ) : (
    <SessionList dataSource={filteredData} showAddButton={false} />
  );
});

SearchMode.displayName = 'SessionSearchMode';

export default SearchMode;
