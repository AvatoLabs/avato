import { type SourceSetStoreState } from '@/store/sourceSet/initialState';

const activeSourceSetId = (s: SourceSetStoreState) => s.activeSourceSetId;

const getSourceSetById = (id: string) => (s: SourceSetStoreState) => s.activeSourceSetItems[id];

const getSourceSetNameById = (id: string) => (s: SourceSetStoreState) =>
  getSourceSetById(id)(s)?.name;

const getSourceSetDescriptionById = (id: string) => (s: SourceSetStoreState) =>
  getSourceSetById(id)(s)?.description;

export const sourceSetSelectors = {
  activeSourceSetId,
  getSourceSetById,
  getSourceSetDescriptionById,
  getSourceSetNameById,
};
