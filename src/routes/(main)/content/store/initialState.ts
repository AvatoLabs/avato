import { type ContentManagerMode } from '@/features/ContentManager';

export interface State {
  currentViewItemId?: string;
  mode: ContentManagerMode;
  selectedFileIds: string[];
}

export const initialState: State = {
  currentViewItemId: undefined,
  mode: 'explorer',
  selectedFileIds: [],
};
