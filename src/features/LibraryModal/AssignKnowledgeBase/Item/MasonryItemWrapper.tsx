import { memo } from 'react';

import { type KnowledgeItem } from '@/types/knowledgeBase';

import { type LibraryModalScope } from '../types';
import MasonryItem from './MasonryItem';

interface MasonryItemWrapperProps {
  context?: {
    scope: LibraryModalScope;
  };
  data: KnowledgeItem;
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
