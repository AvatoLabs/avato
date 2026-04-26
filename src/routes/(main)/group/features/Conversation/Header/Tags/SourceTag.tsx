'use client';

import { type MenuProps } from '@lobehub/ui';
import { DropdownMenu, Flexbox, Icon, Tag } from '@lobehub/ui';
import { LibraryBig } from 'lucide-react';
import { memo } from 'react';

import SourceIcon from '@/components/SourceIcon';
import { useSpaceName } from '@/features/ResourceSpaces';
import { resolveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';
import { oneLineEllipsis } from '@/styles';
import { type AgentSourceItem } from '@/types/sourceSet';

export interface SourceTagProps {
  data: AgentSourceItem[];
}

const SourceLabel = memo(
  ({ activeSpaceId, item }: { activeSpaceId?: string; item: AgentSourceItem }) => {
    const spaceName = useSpaceName(item.spaceId);

    return item.spaceId && item.spaceId !== activeSpaceId && spaceName
      ? `${item.name} · ${spaceName}`
      : item.name;
  },
);

SourceLabel.displayName = 'SourceLabel';

const SourceTag = memo<SourceTagProps>(({ data }) => {
  if (data.length === 0) return null;
  const activeWorkspaceSpaceId = resolveWorkspaceSpaceId();

  const items: MenuProps['items'] = data.map((item) => ({
    icon: <SourceIcon fileType={item.fileType} name={item.name} type={item.type} />,
    key: item.id,
    label: (
      <Flexbox style={{ paddingInlineStart: 8 }}>
        <SourceLabel activeSpaceId={activeWorkspaceSpaceId} item={item} />
      </Flexbox>
    ),
  }));

  const count = data.length;

  return (
    <DropdownMenu items={items}>
      <div>
        <Tag>
          {<Icon icon={LibraryBig} />}
          <div className={oneLineEllipsis} style={{ maxWidth: 140 }}>
            <SourceLabel activeSpaceId={activeWorkspaceSpaceId} item={data[0]} />
          </div>
          {count > 1 && <div>({data.length - 1}+)</div>}
        </Tag>
      </div>
    </DropdownMenu>
  );
});

export default SourceTag;
