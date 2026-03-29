import { useSourceSetStore } from '@/store/sourceSet';

export const useSourceSetItem = (id: string) => {
  const useFetchSourceSetItem = useSourceSetStore((s) => s.useFetchSourceSetItem);

  return useFetchSourceSetItem(id);
};
