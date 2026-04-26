import { Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles } from 'antd-style';
import { memo } from 'react';

import SourceIcon from '@/components/SourceIcon';
import { type AgentSourceItem } from '@/types/sourceSet';

import { type SourceSetModalScope } from '../types';
import Actions from './Action';

const styles = createStaticStyles(({ css, cssVar }) => ({
  desc: css`
    margin: 0 !important;
    font-size: 12px;
    line-height: 1;
    color: ${cssVar.colorTextDescription};
  `,
  link: css`
    overflow: hidden;
    color: ${cssVar.colorText};
  `,
  title: css`
    margin: 0 !important;
    font-size: 14px;
    line-height: 1;
  `,
}));

interface PluginItemProps extends AgentSourceItem {
  scope: SourceSetModalScope;
}

const PluginItem = memo<PluginItemProps>(
  ({ id, fileType, name, type, description, enabled, scope, spaceId }) => {
    return (
      <Flexbox
        horizontal
        align={'center'}
        gap={8}
        justify={'space-between'}
        paddingBlock={12}
        paddingInline={16}
        style={{ position: 'relative' }}
      >
        <Flexbox
          horizontal
          align={'center'}
          flex={1}
          gap={8}
          style={{ overflow: 'hidden', position: 'relative' }}
        >
          <SourceIcon fileType={fileType} name={name} size={{ file: 40, repo: 40 }} type={type} />
          <Flexbox flex={1} gap={4} style={{ overflow: 'hidden', position: 'relative' }}>
            <Flexbox horizontal align={'center'} gap={8}>
              <Text ellipsis className={styles.title}>
                {name}
              </Text>
            </Flexbox>
            {description && (
              <Text ellipsis className={styles.desc}>
                {description}
              </Text>
            )}
          </Flexbox>
        </Flexbox>
        <Actions enabled={enabled} id={id} scope={scope} spaceId={spaceId} type={type} />
      </Flexbox>
    );
  },
);

export default PluginItem;
