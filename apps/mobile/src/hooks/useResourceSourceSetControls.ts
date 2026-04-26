import { useCallback } from 'react';

interface UseResourceSourceSetControlsProps {
  closeScopeLauncher: () => void;
  openCreateSourceSetModalBase: () => void;
  openSourceSetManagementBase: () => void;
  setScopeLauncherVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useResourceSourceSetControls({
  closeScopeLauncher,
  openCreateSourceSetModalBase,
  openSourceSetManagementBase,
  setScopeLauncherVisible,
}: UseResourceSourceSetControlsProps) {
  const openCreateSourceSetModal = useCallback(() => {
    setScopeLauncherVisible(false);
    openCreateSourceSetModalBase();
  }, [openCreateSourceSetModalBase, setScopeLauncherVisible]);

  const openSourceSetManagement = useCallback(
    (options?: { closeLauncher?: boolean }) => {
      if (options?.closeLauncher) closeScopeLauncher();
      openSourceSetManagementBase();
    },
    [closeScopeLauncher, openSourceSetManagementBase],
  );

  return {
    openCreateSourceSetModal,
    openSourceSetManagement,
  };
}
