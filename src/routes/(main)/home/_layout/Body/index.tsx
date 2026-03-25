'use client';

import { Accordion, Flexbox } from '@lobehub/ui';
import { cx } from 'antd-style';
import { memo } from 'react';

import { useGlassNavVisual } from '@/features/NavPanel/GlassNavVisualContext';
import { glassSidebarStyles } from '@/features/NavPanel/glassSidebar.styles';

import Agent from './Agent';
import GroupsPanel from './Groups';
import RecentTopics from './RecentTopics';

export enum GroupKey {
  Agent = 'agent',
  Groups = 'groups',
  Project = 'project',
  RecentTopics = 'recentTopics',
}

const Body = memo(() => {
  const glass = useGlassNavVisual();

  return (
    <Flexbox
      className={cx(glass && glassSidebarStyles.scrollAccordionBody)}
      flex={1}
      paddingInline={8}
      style={{ minHeight: 0 }}
    >
      <Accordion
        defaultExpandedKeys={[GroupKey.Agent, GroupKey.Groups, GroupKey.RecentTopics]}
        gap={10}
      >
        <Agent itemKey={GroupKey.Agent} />
        <GroupsPanel itemKey={GroupKey.Groups} />
        <RecentTopics itemKey={GroupKey.RecentTopics} />
      </Accordion>
    </Flexbox>
  );
});

export default Body;
