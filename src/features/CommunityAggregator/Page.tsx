'use client';

import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { useQuery } from '@/hooks/useQuery';
import { AggregatorKind } from '@/types/aggregator';

import McpPage from './McpPage';
import ModeSwitch from './ModeSwitch';
import SkillPage from './SkillPage';

const CommunityAggregatorPage = memo(() => {
  const { kind } = useQuery();
  const activeKind = kind === AggregatorKind.Skills ? AggregatorKind.Skills : AggregatorKind.Mcp;

  return (
    <Flexbox gap={24} width={'100%'}>
      <ModeSwitch activeKind={activeKind} />
      {activeKind === AggregatorKind.Skills ? <SkillPage /> : <McpPage />}
    </Flexbox>
  );
});

CommunityAggregatorPage.displayName = 'CommunityAggregatorPage';

export default CommunityAggregatorPage;
