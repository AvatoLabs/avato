/**
 * @vitest-environment happy-dom
 */
import { getSpaceMemorySurfaceContract } from '@lobechat/types';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SpaceRedirectPage from './SpaceRedirectPage';

const { spacesState, summariesState } = vi.hoisted(() => ({
  spacesState: {
    current: [] as Array<{ id: string; kind: 'personal' | 'team'; name: string }>,
  },
  summariesState: {
    current: [] as Array<[string, any]>,
  },
}));

vi.mock('@lobehub/ui', () => ({
  Center: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: any) => <div data-testid={'redirect-target'}>{to}</div>,
  useLocation: () => ({ search: '?from=legacy' }),
}));

vi.mock('swr', () => ({
  default: (key: unknown) => {
    if (key === 'resource-space-list') {
      return { data: spacesState.current, isLoading: false };
    }

    if (Array.isArray(key) && key[0] === 'space-memory-scope-summaries') {
      return { data: summariesState.current, isLoading: false };
    }

    return { data: undefined, isLoading: false };
  },
}));

vi.mock('@/components/Loading/BrandTextLoading', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('@/libs/trpc/client', () => ({
  lambdaClient: {
    space: {
      listSpaces: {
        query: vi.fn(),
      },
    },
    spaceMemory: {
      getSummary: {
        query: vi.fn(),
      },
    },
  },
}));

const makeSummary = (
  recall?: {
    playbooks?: { active: number; disabled: number; expired: number; stale: number };
    policies?: { active: number; disabled: number; expired: number; stale: number };
    published?: { active: number; disabled: number; expired: number; stale: number };
  },
  options?: { canReview?: boolean },
) => ({
  canCreate: true,
  canPublish: true,
  canReview: options?.canReview ?? true,
  contract: getSpaceMemorySurfaceContract(options?.canReview === false ? 'viewer' : 'reviewer', {
    canCreate: true,
  }),
  id: 'spc_ops',
  kind: 'team',
  membershipRole: 'editor',
  name: 'Ops Space',
  surface: options?.canReview === false ? 'viewer' : 'reviewer',
  sections: {
    inbox: { count: 0, recall: { active: 0, disabled: 0, expired: 0, stale: 0 } },
    playbooks: {
      count: 0,
      recall: recall?.playbooks ?? { active: 0, disabled: 0, expired: 0, stale: 0 },
    },
    policies: {
      count: 0,
      recall: recall?.policies ?? { active: 0, disabled: 0, expired: 0, stale: 0 },
    },
    published: {
      count: 0,
      recall: recall?.published ?? { active: 0, disabled: 0, expired: 0, stale: 0 },
    },
  },
});

describe('SpaceRedirectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefers the first pending governance target over the personal space default', () => {
    spacesState.current = [
      { id: 'spc_personal', kind: 'personal', name: 'My Space' },
      { id: 'spc_ops', kind: 'team', name: 'Ops Space' },
    ];
    summariesState.current = [
      [
        'spc_ops',
        makeSummary({
          published: { active: 1, disabled: 0, expired: 0, stale: 1 },
        }),
      ],
    ];

    render(<SpaceRedirectPage />);

    expect(screen.getByTestId('redirect-target')).toHaveTextContent(
      '/spaces/spc_ops/memory?section=published&recallFilter=stale&from=legacy',
    );
  });

  it('falls back to the personal space root when there is no pending governance target', () => {
    spacesState.current = [
      { id: 'spc_personal', kind: 'personal', name: 'My Space' },
      { id: 'spc_ops', kind: 'team', name: 'Ops Space' },
    ];
    summariesState.current = [['spc_ops', makeSummary()]];

    render(<SpaceRedirectPage />);

    expect(screen.getByTestId('redirect-target')).toHaveTextContent(
      '/spaces/spc_personal/files?from=legacy',
    );
  });

  it('does not redirect to governance targets when the member cannot review', () => {
    spacesState.current = [
      { id: 'spc_personal', kind: 'personal', name: 'My Space' },
      { id: 'spc_ops', kind: 'team', name: 'Ops Space' },
    ];
    summariesState.current = [
      [
        'spc_ops',
        makeSummary(
          {
            published: { active: 1, disabled: 0, expired: 0, stale: 1 },
          },
          { canReview: false },
        ),
      ],
    ];

    render(<SpaceRedirectPage />);

    expect(screen.getByTestId('redirect-target')).toHaveTextContent(
      '/spaces/spc_personal/files?from=legacy',
    );
  });
});
