/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import EmptyPlaceholder from './EmptyPlaceholder';

const mockNavigate = vi.hoisted(() => vi.fn());
const mockOpenCreateSourceSet = vi.hoisted(() => vi.fn());
const mockPushDockFileList = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Center: ({ children, className, style }: any) => (
    <div className={className} style={style}>
      {children}
    </div>
  ),
  FileTypeIcon: ({ icon, className }: any) => <div className={className}>{icon}</div>,
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
  Text: ({ children, className }: any) => <span className={className}>{children}</span>,
}));

vi.mock('antd', () => ({
  Upload: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('antd-style', () => {
  const mockCssVar = {
    borderRadiusLG: '12px',
    colorBgContainer: '#fff',
    colorBorder: '#ddd',
    colorBorderSecondary: '#eee',
    colorFillSecondary: '#f5f5f5',
    colorPrimary: '#1677ff',
    colorPrimaryBg: '#e6f4ff',
    colorPrimaryBorder: '#91caff',
    colorText: '#111',
    colorTextLightSolid: '#fff',
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
    plus: () => <span>plus</span>,
    uploadArrow: () => <span>upload</span>,
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
      sourceSetId: undefined,
      spaceId: 'space-1',
    }),
}));

vi.mock('@/store/file', () => ({
  useFileStore: (selector: any) =>
    selector({
      pushDockFileList: mockPushDockFileList,
    }),
}));

vi.mock('@/store/serverConfig', () => ({
  useServerConfigStore: (selector: any) =>
    selector({
      isMobile: false,
    }),
}));

describe('EmptyPlaceholder', () => {
  it('renders keyboard-accessible buttons for all empty-state actions', () => {
    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /actions\.sourceSet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions\.file/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /actions\.folder/i })).toBeInTheDocument();
  });

  it('keeps create source-set action wired after switching to button semantics', () => {
    render(
      <MemoryRouter>
        <EmptyPlaceholder />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: /actions\.sourceSet/i }));

    expect(mockOpenCreateSourceSet).toHaveBeenCalledWith({
      onSuccess: expect.any(Function),
      spaceId: 'space-1',
    });
  });
});
