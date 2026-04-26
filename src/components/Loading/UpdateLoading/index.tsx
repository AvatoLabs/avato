import { type CSSProperties } from 'react';
import { memo } from 'react';

import BubblesLoading from '@/components/BubblesLoading';

interface UpdateLoadingProps {
  size?: number | { size?: number } | string;
  style?: CSSProperties;
}

const resolveSize = (size?: UpdateLoadingProps['size']) => {
  if (typeof size === 'number') return Math.max(4, Math.round(size / 2.4));
  if (typeof size === 'object' && typeof size?.size === 'number') {
    return Math.max(4, Math.round(size.size / 2.4));
  }
  if (size === 'small') return 5;
  if (size === 'large') return 8;

  return 6;
};

const UpdateLoading = memo<UpdateLoadingProps>(({ size, style }) => {
  return (
    <div style={style}>
      <BubblesLoading size={resolveSize(size)} />
    </div>
  );
});

export default UpdateLoading;
