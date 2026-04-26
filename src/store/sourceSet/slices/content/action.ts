import { sourceSetService } from '@/services/sourceSet';
import { revalidatePageDocuments } from '@/store/docs/slices/list/action';
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

    // Keep content and docs sidebars in sync after source-set assignment changes.
    await Promise.all([revalidateResources(), revalidatePageDocuments()]);
  };

  removeFilesFromSourceSet = async (sourceSetId: string, ids: string[]): Promise<void> => {
    await sourceSetService.removeFilesFromSourceSet(sourceSetId, ids);

    // Keep content and docs sidebars in sync after source-set assignment changes.
    await Promise.all([revalidateResources(), revalidatePageDocuments()]);
  };
}

export type SourceSetContentAction = Pick<
  SourceSetContentActionImpl,
  keyof SourceSetContentActionImpl
>;
