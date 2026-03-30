/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import SourceSetListSection from './SourceSetListSection';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockOpenCreateSourceSet = vi.hoisted(() => vi.fn());
const mockUseFetchSourceSetList = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Flexbox: ({ children, className, style }: any) => (
    <div className={className} style={style}>
      {children}
    </div>
  ),
  Icon: ({ icon: IconComponent }: any) =>
    IconComponent ? (
      <span aria-hidden="true">
        <IconComponent data-testid="icon" />
      </span>
    ) : (
      <span aria-hidden="true">icon</span>
    ),
  Text: ({ children, className, style }: any) => (
    <span className={className} style={style}>
      {children}
    </span>
  ),
}));

vi.mock('antd-style', () => {
  const mockCssVar = {
    colorBorder: '#ddd',
    colorFillSecondary: '#f5f5f5',
    colorFillTertiary: '#fafafa',
    colorPrimary: '#1677ff',
  };

  return {
    createStaticStyles: (factory: any) => factory({ css: () => 'cls', cssVar: mockCssVar }),
    cssVar: mockCssVar,
    cx: (...classNames: string[]) => classNames.filter(Boolean).join(' '),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');

  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/config/contentIcons', () => ({
  RESOURCE_ENTRY_ICONS: {
    sourceSet: () => <span>sourceSet</span>,
  },
}));

vi.mock('@/features/SourceSetModal', () => ({
  useCreateSourceSetModal: () => ({
    open: mockOpenCreateSourceSet,
  }),
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildSourceSetPath: (spaceId: string | undefined, id: string) =>
    `/content/spaces/${spaceId}/source-sets/${id}`,
}));

vi.mock('@/routes/(main)/content/features/store', () => ({
  useContentManagerStore: (selector: any) =>
    selector({
      spaceId: 'space-1',
    }),
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      useFetchSourceSetList: mockUseFetchSourceSetList,
    }),
}));

describe('SourceSetListSection', () => {
  it('renders source-set cards and create action as buttons', () => {
    mockUseFetchSourceSetList.mockReturnValue({
      data: [{ id: 'ss-1', name: 'Docs', spaceId: undefined }],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <SourceSetListSection />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /Docs/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Source Set' })).toBeInTheDocument();
  });

  it('preserves existing actions after switching cards to buttons', () => {
    mockUseFetchSourceSetList.mockReturnValue({
      data: [{ id: 'ss-1', name: 'Docs', spaceId: undefined }],
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <SourceSetListSection />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Docs/i }));
    fireEvent.click(screen.getByRole('button', { name: 'New Source Set' }));

    expect(mockNavigate).toHaveBeenCalledWith('/content/spaces/space-1/source-sets/ss-1');
    expect(mockOpenCreateSourceSet).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
      spaceId: 'space-1',
    });
  });
});
