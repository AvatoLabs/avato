import { LayersEnum } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { buildSpaceMemoryCandidatesFromUserMemoryExtraction } from './userMemoryCandidate';

describe('buildSpaceMemoryCandidatesFromUserMemoryExtraction', () => {
  it('maps context memories to general candidates and experience memories to playbooks', () => {
    const result = buildSpaceMemoryCandidatesFromUserMemoryExtraction({
      extraction: {
        decision: {
          activity: { reasoning: '', shouldExtract: false },
          context: { reasoning: '', shouldExtract: true },
          experience: { reasoning: '', shouldExtract: true },
          identity: { reasoning: '', shouldExtract: false },
          preference: { reasoning: '', shouldExtract: false },
        },
        inputs: {},
        layers: [LayersEnum.Context, LayersEnum.Experience],
        outputs: {
          context: {
            data: {
              memories: [
                {
                  details: 'Acme renewal is blocked on legal review.',
                  memoryCategory: 'project',
                  memoryType: 'context',
                  summary: 'Acme renewal is waiting on legal review.',
                  title: 'Acme renewal status',
                  withContext: {
                    currentStatus: 'blocked',
                    description: 'Legal needs to approve renewal language.',
                    title: 'Acme renewal',
                  },
                },
              ],
            } as any,
          },
          experience: {
            data: {
              memories: [
                {
                  details: 'The rollout succeeded after adding a named rollback owner.',
                  memoryCategory: 'operations',
                  memoryType: 'experience',
                  summary: 'Assigning a rollback owner makes releases safer.',
                  title: 'Rollback owner practice',
                  withExperience: {
                    action: 'Assign a rollback owner before rollout.',
                    keyLearning: 'Explicit ownership reduced confusion during deploy.',
                    possibleOutcome: 'Faster recovery during incidents.',
                    situation: 'Friday production rollout',
                  },
                },
              ],
            } as any,
          },
        },
        processedCounts: 2,
        processedErrorsCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 0,
          [LayersEnum.Experience]: 0,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
        processedLayersCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 1,
          [LayersEnum.Experience]: 1,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
      },
      messageIds: ['msg_1', 'msg_2'],
      topic: {
        id: 'topic_1',
        title: 'Renewal thread',
      },
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      category: 'general',
      summary: 'Acme renewal is waiting on legal review.',
      title: 'Acme renewal status',
    });
    expect(result[1]).toMatchObject({
      category: 'playbook',
      summary: 'Assigning a rollback owner makes releases safer.',
      title: 'Rollback owner practice',
    });
    expect(result[0].sourceRefs).toEqual([
      { id: 'topic_1', kind: 'topic', title: 'Renewal thread' },
      { id: 'msg_1', kind: 'message' },
      { id: 'msg_2', kind: 'message' },
    ]);
  });

  it('deduplicates candidates with the same category, title, and summary', () => {
    const result = buildSpaceMemoryCandidatesFromUserMemoryExtraction({
      extraction: {
        decision: {
          activity: { reasoning: '', shouldExtract: false },
          context: { reasoning: '', shouldExtract: true },
          experience: { reasoning: '', shouldExtract: false },
          identity: { reasoning: '', shouldExtract: false },
          preference: { reasoning: '', shouldExtract: false },
        },
        inputs: {},
        layers: [LayersEnum.Context],
        outputs: {
          context: {
            data: {
              memories: [
                {
                  details: 'First version',
                  summary: 'Shared project status',
                  title: 'Project alpha',
                  withContext: {},
                },
                {
                  details: 'Second version',
                  summary: 'Shared project status',
                  title: 'Project alpha',
                  withContext: {},
                },
              ],
            } as any,
          },
        },
        processedCounts: 2,
        processedErrorsCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 0,
          [LayersEnum.Experience]: 0,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
        processedLayersCount: {
          [LayersEnum.Activity]: 0,
          [LayersEnum.Context]: 1,
          [LayersEnum.Experience]: 0,
          [LayersEnum.Identity]: 0,
          [LayersEnum.Preference]: 0,
        },
      },
      topic: {
        id: 'topic_2',
      },
    });

    expect(result).toHaveLength(1);
  });
});
