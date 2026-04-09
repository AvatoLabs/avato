/**
 * @vitest-environment happy-dom
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ActivityDropdown from '../activities/features/ActivityDropdown';
import ContextDropdown from '../contexts/features/ContextDropdown';
import ExperienceDropdown from '../experiences/features/ExperienceDropdown';
import IdentityDropdown from '../identities/features/IdentityDropdown';
import PreferenceDropdown from '../preferences/features/PreferenceDropdown';

const mockModalConfirm = vi.hoisted(() => vi.fn());
const mockMessageError = vi.hoisted(() => vi.fn());
const mockSetQueryState = vi.hoisted(() => vi.fn());
const mockToggleRightPanel = vi.hoisted(() => vi.fn());
const memoryStoreState = vi.hoisted(() => ({
  activities: [] as any[],
  contexts: [] as any[],
  deleteActivity: vi.fn(),
  deleteContext: vi.fn(),
  deleteExperience: vi.fn(),
  deleteIdentity: vi.fn(),
  deletePreference: vi.fn(),
  experiences: [] as any[],
  identities: [] as any[],
  preferences: [] as any[],
  setEditingMemory: vi.fn(),
}));

vi.mock('@lobehub/ui', () => ({
  ActionIcon: () => null,
  DropdownMenu: ({ items }: any) => (
    <div>
      {items?.map((item: any) => (
        <button
          key={item.key}
          type="button"
          onClick={() =>
            item.onClick?.({
              domEvent: { stopPropagation: vi.fn() },
              key: item.key,
            })
          }
        >
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('antd', () => ({
  App: {
    useApp: () => ({
      message: {
        error: mockMessageError,
      },
      modal: {
        confirm: mockModalConfirm,
      },
    }),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useQueryParam', () => ({
  useQueryState: () => ['memory-1', mockSetQueryState],
}));

vi.mock('@/store/global', () => ({
  useGlobalStore: (selector: any) =>
    selector({
      toggleRightPanel: mockToggleRightPanel,
    }),
}));

vi.mock('@/store/userMemory', () => ({
  useUserMemoryStore: (selector: any) => selector(memoryStoreState),
}));

describe('Memory delete dropdowns', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  type DeleteActionKey =
    | 'deleteActivity'
    | 'deleteContext'
    | 'deleteExperience'
    | 'deleteIdentity'
    | 'deletePreference';

  const cases: Array<{
    buttonName: string;
    component: ComponentType<{ id: string }>;
    deleteFn: DeleteActionKey;
    errorKey: string;
    logMessage: string;
  }> = [
    {
      buttonName: 'delete',
      component: IdentityDropdown,
      deleteFn: 'deleteIdentity',
      errorKey: 'identity.list.deleteError',
      logMessage: 'Failed to delete identity memory:',
    },
    {
      buttonName: 'context.actions.delete',
      component: ContextDropdown,
      deleteFn: 'deleteContext',
      errorKey: 'context.deleteError',
      logMessage: 'Failed to delete context memory:',
    },
    {
      buttonName: 'activity.actions.delete',
      component: ActivityDropdown,
      deleteFn: 'deleteActivity',
      errorKey: 'activity.deleteError',
      logMessage: 'Failed to delete activity memory:',
    },
    {
      buttonName: 'preference.actions.delete',
      component: PreferenceDropdown,
      deleteFn: 'deletePreference',
      errorKey: 'preference.deleteError',
      logMessage: 'Failed to delete preference memory:',
    },
    {
      buttonName: 'experience.actions.delete',
      component: ExperienceDropdown,
      deleteFn: 'deleteExperience',
      errorKey: 'experience.deleteError',
      logMessage: 'Failed to delete experience memory:',
    },
  ];

  it.each(cases)(
    'shows an error when deleting %s fails',
    async ({ buttonName, component: Component, deleteFn, errorKey, logMessage }) => {
      const error = new Error(`${String(deleteFn)} failed`);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      memoryStoreState[deleteFn].mockRejectedValue(error);

      render(<Component id="memory-1" />);

      fireEvent.click(screen.getByRole('button', { name: buttonName }));

      const confirmConfig = mockModalConfirm.mock.calls[0][0];
      await act(async () => {
        await confirmConfig.onOk();
      });

      expect(memoryStoreState[deleteFn]).toHaveBeenCalledWith('memory-1');
      expect(mockMessageError).toHaveBeenCalledWith(errorKey);
      expect(mockSetQueryState).not.toHaveBeenCalled();
      expect(mockToggleRightPanel).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(logMessage, error);

      consoleErrorSpy.mockRestore();
    },
  );
});
