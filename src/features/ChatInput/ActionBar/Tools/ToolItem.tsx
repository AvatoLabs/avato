import { Flexbox, Text } from '@lobehub/ui';
import { memo, Suspense } from 'react';

import DebugNode from '@/components/DebugNode';
import PluginTag from '@/components/Plugins/PluginTag';
import { customPluginSelectors } from '@/store/tool/selectors';
import { useToolStore } from '@/store/tool/store';

import type { CheckboxItemProps } from '../components/CheckboxWithLoading';
import CheckboxItem from '../components/CheckboxWithLoading';

const ToolItem = memo<CheckboxItemProps>(({ id, onUpdate, label, checked }) => {
  const isCustom = useToolStore((s) => customPluginSelectors.isCustomPlugin(id)(s));
  const labelText = typeof label === 'number' || typeof label === 'string' ? String(label) : id;

  return (
    <Suspense fallback={<DebugNode trace="ActionBar/Tools/ToolItem" />}>
      <CheckboxItem
        checked={checked}
        hasPadding={false}
        id={id}
        label={
          <Flexbox allowShrink horizontal align={'center'} gap={8}>
            <Text ellipsis style={{ lineHeight: 1.4, paddingBlock: 1 }} title={labelText}>
              {label || id}
            </Text>
            {isCustom && <PluginTag showText={false} type={'customPlugin'} />}
          </Flexbox>
        }
        onUpdate={onUpdate}
      />
    </Suspense>
  );
});

export default ToolItem;
