'use client';

import { memo } from 'react';

import StatusResultPage from '../../../features/StatusResultPage';

interface StatusPageProps {
  status: 'unpublished' | 'archived' | 'deprecated';
}

const StatusPage = memo<StatusPageProps>(({ status }) => {
  return <StatusResultPage backTo="/community" i18nPrefix="groupAgents.status" status={status} />;
});

export default StatusPage;
