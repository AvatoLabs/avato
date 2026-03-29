import { memo } from 'react';

import { type AgentSourceItem } from '@/types/sourceSet';

import { type SourceSetModalScope } from '../types';
import MasonryItem from './MasonryItem';

interface MasonryItemWrapperProps {
  context?: {
    scope: SourceSetModalScope;
  };
  data: AgentSourceItem;
  index: number;
}

const MasonryItemWrapper = memo<MasonryItemWrapperProps>(({ data: item, context }) => {
  // Safety check: return null if item is undefined
  if (!item || !item.id) {
    return null;
  }

  return (
    <div style={{ padding: '8px 4px' }}>
      <MasonryItem {...item} scope={context?.scope ?? 'agent'} />
    </div>
  );
});

MasonryItemWrapper.displayName = 'MasonryItemWrapper';

export default MasonryItemWrapper;
