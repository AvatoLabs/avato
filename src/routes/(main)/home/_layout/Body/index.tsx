'use client';

import { Accordion, Flexbox } from '@lobehub/ui';
import { memo } from 'react';

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
  return (
    <Flexbox flex={1} paddingInline={8} style={{ minHeight: 0 }}>
      <Accordion
        gap={10}
        defaultExpandedKeys={[
          GroupKey.RecentTopics,
          GroupKey.Groups,
          GroupKey.Project,
          GroupKey.Agent,
        ]}
      >
        <RecentTopics itemKey={GroupKey.RecentTopics} />
        <GroupsPanel itemKey={GroupKey.Groups} />
        <Agent itemKey={GroupKey.Agent} />
      </Accordion>
    </Flexbox>
  );
});

export default Body;
