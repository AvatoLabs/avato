import { useAnalytics } from '@lobehub/analytics/react';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';
import LazyLoad from 'react-lazy-load';
import { Link } from 'react-router-dom';

import { useChatStore } from '@/store/chat';
import { useServerConfigStore } from '@/store/serverConfig';
import { getSessionStoreState, useSessionStore } from '@/store/session';
import { sessionGroupSelectors, sessionSelectors } from '@/store/session/selectors';
import { getUserStoreState } from '@/store/user';
import { userProfileSelectors } from '@/store/user/selectors';
import { type LobeSessions } from '@/types/session';

import SkeletonList from '../../SkeletonList';
import AddButton from './AddButton';
import SessionItem from './Item';
import { getSessionListItemUrl } from './url';

const styles = createStaticStyles(({ css, cssVar }) => ({
  item: css`
    min-height: 70px;
  `,
  link: css`
    display: block;
    color: inherit;
    text-decoration: none;

    -webkit-tap-highlight-color: transparent;

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: 2px;
    }
  `,
}));
interface SessionListProps {
  dataSource?: LobeSessions;
  groupId?: string;
  showAddButton?: boolean;
}

const SessionList = memo<SessionListProps>(({ dataSource, groupId, showAddButton = true }) => {
  const { analytics } = useAnalytics();

  const isInit = useSessionStore(sessionSelectors.isSessionListInit);
  const mobile = useServerConfigStore((s) => s.isMobile);
  const clearPortalStack = useChatStore((s) => s.clearPortalStack);

  const isEmpty = !dataSource || dataSource.length === 0;
  return !isInit ? (
    <SkeletonList />
  ) : !isEmpty ? (
    dataSource.map((sessionItem) => (
      <LazyLoad className={styles.item} key={sessionItem.id}>
        <Link
          aria-label={sessionItem.id}
          className={styles.link}
          to={getSessionListItemUrl(sessionItem, mobile)}
          onClick={() => {
            clearPortalStack();

            // Enhanced analytics tracking
            if (analytics) {
              const userStore = getUserStoreState();
              const sessionStore = getSessionStoreState();

              const userId = userProfileSelectors.userId(userStore);
              const session = sessionSelectors.getSessionById(sessionItem.id)(sessionStore);

              if (session) {
                const sessionGroupId = session.group || 'default';
                const group = sessionGroupSelectors.getGroupById(sessionGroupId)(sessionStore);
                const groupName =
                  group?.name || (sessionGroupId === 'default' ? 'Default' : 'Unknown');

                analytics?.track({
                  name: 'switch_session',
                  properties: {
                    assistant_name: session.meta?.title || 'Untitled Agent',
                    assistant_tags: session.meta?.tags || [],
                    group_id: sessionGroupId,
                    group_name: groupName,
                    session_id: sessionItem.id,
                    spm: 'homepage.chat.session_list_item.click',
                    user_id: userId || 'anonymous',
                  },
                });
              }
            }
          }}
        >
          <SessionItem id={sessionItem.id} />
        </Link>
      </LazyLoad>
    ))
  ) : (
    showAddButton && <AddButton groupId={groupId} />
  );
});

export default SessionList;
