import { type SourceSetItem } from '@/types/sourceSet';

export interface SourceSetState {
  activeSourceSetId: string | null;
  activeSourceSetItems: Record<string, SourceSetItem>;
  initSourceSetList: boolean;
  sourceSetLoadingIds: string[];
  sourceSetRenamingId?: string | null;
  sourceSetUpdatingId: string | null;
}

export const initialSourceSetState: SourceSetState = {
  activeSourceSetId: null,
  activeSourceSetItems: {},
  initSourceSetList: false,
  sourceSetLoadingIds: [],
  sourceSetRenamingId: null,
  sourceSetUpdatingId: null,
};
