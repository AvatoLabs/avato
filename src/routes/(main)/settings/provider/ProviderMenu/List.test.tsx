/**
 * @vitest-environment happy-dom
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ProviderList from './List';

const aiInfraStoreState = vi.hoisted(() => ({
  disabledAiProviderList: [
    { enabled: false, id: 'zulu', name: undefined, source: 'builtin' },
    { enabled: false, id: 'alpha', name: 'omega', source: 'builtin' },
  ],
  disabledCustomAiProviderList: [],
  enabledAiProviderList: [],
}));

const globalStoreState = vi.hoisted(() => ({
  sortType: 'alphabeticalDesc',
  updateSystemStatus: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  Accordion: ({ children }: any) => <div>{children}</div>,
  AccordionItem: ({ children, title }: any) => (
    <section>
      <div>{title}</div>
      <div>{children}</div>
    </section>
  ),
  ActionIcon: ({ onClick, title }: any) => (
    <button aria-label={title || 'action'} type="button" onClick={onClick} />
  ),
  ContextMenuTrigger: ({ children }: any) => <div>{children}</div>,
  Flexbox: ({ children }: any) => <div>{children}</div>,
  Text: ({ children }: any) => <span>{children}</span>,
  stopPropagation: () => undefined,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/store/aiInfra', () => ({
  aiProviderSelectors: {
    disabledAiProviderList: () => aiInfraStoreState.disabledAiProviderList,
    disabledCustomAiProviderList: () => aiInfraStoreState.disabledCustomAiProviderList,
    enabledAiProviderList: () => aiInfraStoreState.enabledAiProviderList,
  },
}));

vi.mock('@/store/aiInfra/store', () => ({
  useAiInfraStore: (selector: any) => selector(aiInfraStoreState),
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      updateSystemStatus: globalStoreState.updateSystemStatus,
    }),
}));

vi.mock('@/store/global/selectors', () => ({
  systemStatusSelectors: {
    disabledModelProvidersSortType: () => globalStoreState.sortType,
  },
}));

vi.mock('./Actions', () => ({
  default: () => null,
}));

vi.mock('./All', () => ({
  default: () => null,
}));

vi.mock('./Item', () => ({
  default: ({ id, name }: any) => <div>{name || id}</div>,
}));

vi.mock('./SortProviderModal', () => ({
  default: () => null,
}));

vi.mock('./useDropdownMenu', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./useDropdownMenu')>();
  return {
    ...actual,
    useProviderDropdownMenu: () => [],
  };
});

describe('ProviderMenu List', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalStoreState.sortType = 'alphabeticalDesc';
  });

  it('sorts disabled providers by display name fallback in descending order', () => {
    render(<ProviderList onProviderSelect={vi.fn()} />);

    const disabledHeader = screen.getByText('menu.list.disabled');
    const disabledSection = disabledHeader.closest('section');
    const zuluNode = screen.getByText('zulu');
    const omegaNode = screen.getByText('omega');

    expect(disabledSection).not.toBeNull();
    expect(disabledSection).toHaveTextContent('zulu');
    expect(disabledSection).toHaveTextContent('omega');
    expect(zuluNode.compareDocumentPosition(omegaNode) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });
});
