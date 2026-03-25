import { useToolStore } from '@/store/tool/store';

export const useFetchInstalledPlugins = () => {
  const [useFetchInstalledPlugins] = useToolStore((s) => [s.useFetchInstalledPlugins]);

  return useFetchInstalledPlugins(true);
};
