'use client';

import { memo } from 'react';

import StatusResultPage from '../../../features/StatusResultPage';

interface StatusPageProps {
  status: 'unpublished' | 'archived' | 'deprecated';
}

const StatusPage = memo<StatusPageProps>(({ status }) => {
  return (
    <StatusResultPage backTo="/community/agent" i18nPrefix="assistants.status" status={status} />
  );
});

export default StatusPage;
