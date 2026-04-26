import { useToolStore } from '@/store/tool/store';

export const useCheckPluginsIsInstalled = (plugins: string[]) => {
  const checkPluginsIsInstalled = useToolStore((s) => s.useCheckPluginsIsInstalled);

  checkPluginsIsInstalled(true, plugins);
};
