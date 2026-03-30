import { sourceSetService } from '@/services/sourceSet';
import { revalidateResources } from '@/store/file/slices/content/hooks';
import { type SourceSetStore } from '@/store/sourceSet/store';
import { type StoreSetter } from '@/store/types';

type Setter = StoreSetter<SourceSetStore>;
export const createContentSlice = (set: Setter, get: () => SourceSetStore, _api?: unknown) =>
  new SourceSetContentActionImpl(set, get, _api);

export class SourceSetContentActionImpl {
  constructor(set: Setter, get: () => SourceSetStore, _api?: unknown) {
    void _api;
    void set;
    void get;
  }

  addFilesToSourceSet = async (sourceSetId: string, ids: string[]): Promise<void> => {
    await sourceSetService.addFilesToSourceSet(sourceSetId, ids);

    // Revalidate content list to show updated source-set associations.
    await revalidateResources();
  };

  removeFilesFromSourceSet = async (sourceSetId: string, ids: string[]): Promise<void> => {
    await sourceSetService.removeFilesFromSourceSet(sourceSetId, ids);

    // Revalidate content list to show updated source-set associations.
    await revalidateResources();
  };
}

export type SourceSetContentAction = Pick<
  SourceSetContentActionImpl,
  keyof SourceSetContentActionImpl
>;
