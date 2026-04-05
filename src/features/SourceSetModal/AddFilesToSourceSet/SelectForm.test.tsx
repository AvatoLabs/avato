/**
 * @vitest-environment happy-dom
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { setActiveWorkspaceSpaceId } from '@/helpers/activeWorkspaceSpace';

import SelectForm from './SelectForm';

const formValues: { id?: string } = {};
const mockBuildSourceSetPath = vi.hoisted(() =>
  vi.fn(
    (spaceId?: string | null, sourceSetId?: string) =>
      `/spaces/${spaceId}/files?scope=source-set:${sourceSetId}`,
  ),
);
const mockUseFetchSourceSetList = vi.hoisted(() => vi.fn());
const mockAddFilesToSourceSet = vi.hoisted(() => vi.fn());
const mockMessageSuccess = vi.hoisted(() => vi.fn());

vi.mock('@lobehub/ui', () => ({
  Block: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, htmlType, onClick }: any) => (
    <button type={htmlType === 'submit' ? 'submit' : 'button'} onClick={onClick}>
      {children}
    </button>
  ),
  Flexbox: ({ as, children, ...props }: any) => {
    const Component = as || 'div';
    return <Component {...props}>{children}</Component>;
  },
  Form: ({ footer, items, onFinish }: any) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void onFinish({ ...formValues });
      }}
    >
      {items.map((item: any, index: number) => (
        <label key={item.name || index}>
          {item.label}
          {item.children}
        </label>
      ))}
      {footer}
    </form>
  ),
  MaterialFileTypeIcon: () => <span>file-icon</span>,
  Select: ({ options, placeholder }: any) => (
    <select
      aria-label={placeholder}
      defaultValue=""
      onChange={(e) => {
        formValues.id = e.target.value;
      }}
    >
      <option value="">placeholder</option>
      {options.map((option: any) => (
        <option key={option.value} value={option.value}>
          {option.value}
        </option>
      ))}
    </select>
  ),
  Tag: ({ children }: any) => <span>{children}</span>,
  Text: ({ children }: any) => <span>{children}</span>,
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        success: mockMessageSuccess,
      },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  Trans: ({ components }: any) => (
    <div>
      {components?.[0]}
      {components?.[1]}
    </div>
  ),
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; name?: string }) =>
      ({
        'addToSourceSet.addSuccess': 'Add success',
        'addToSourceSet.confirm': 'Add',
        'addToSourceSet.id.placeholder': 'Please select a source set',
        'addToSourceSet.id.required': 'Please select a source set',
        'addToSourceSet.id.title': 'Target Source Set',
        'addToSourceSet.totalFiles': `${options?.count ?? 0} files selected`,
        'addToSourceSet.workspace': 'Workspace',
        'addToSourceSet.workspaceHint': `Showing source sets from ${options?.name} first.`,
      })[key] || key,
  }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: any) => <a href={to}>{children || to}</a>,
}));

vi.mock('@/components/LibIcon', () => ({
  default: () => <span>repo-icon</span>,
}));

vi.mock('@/features/ResourceSpaces', () => ({
  buildSourceSetPath: mockBuildSourceSetPath,
  useSpaceName: (spaceId?: string | null) =>
    ({ 'space-route': 'Ops Workspace', 'space-hint': 'Hint Workspace' })[spaceId || ''],
}));

vi.mock('@/store/sourceSet', () => ({
  useSourceSetStore: (selector: any) =>
    selector({
      addFilesToSourceSet: mockAddFilesToSourceSet,
      useFetchSourceSetList: mockUseFetchSourceSetList,
    }),
}));

describe('SelectForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    formValues.id = undefined;
    setActiveWorkspaceSpaceId('space-hint');
    window.history.replaceState({}, '', '/spaces/space-route/files');
    mockAddFilesToSourceSet.mockResolvedValue(undefined);
    mockUseFetchSourceSetList.mockReturnValue({
      data: [
        { id: 'ss-1', name: 'Ops Guide' },
        { id: 'ss-2', name: 'Runbooks' },
      ],
      isLoading: false,
    });
  });

  it('fetches source sets from the current route workspace and shows the workspace hint', () => {
    render(<SelectForm fileIds={['file-1']} />);

    expect(mockUseFetchSourceSetList).toHaveBeenCalledWith('space-route');
    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(screen.getByText('Showing source sets from Ops Workspace first.')).toBeInTheDocument();
  });

  it('uses the current route workspace in the success link after adding files', async () => {
    const onClose = vi.fn();
    render(<SelectForm fileIds={['file-1', 'file-2']} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText('Please select a source set'), {
      target: { value: 'ss-2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(mockAddFilesToSourceSet).toHaveBeenCalledWith('ss-2', ['file-1', 'file-2']);
    });

    expect(mockBuildSourceSetPath).toHaveBeenCalledWith('space-route', 'ss-2');
    expect(mockMessageSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
