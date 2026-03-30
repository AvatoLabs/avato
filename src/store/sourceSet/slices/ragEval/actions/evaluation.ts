import { type CreateNewEvalEvaluation, type RAGEvalDataSetItem } from '@lobechat/types';
import { type SWRResponse } from 'swr';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { ragEvalService } from '@/services/ragEval';
import { type SourceSetStore } from '@/store/sourceSet/store';
import { type StoreSetter } from '@/store/types';

const FETCH_EVALUATION_LIST_KEY = 'FETCH_EVALUATION_LIST_KEY';

type Setter = StoreSetter<SourceSetStore>;
export const createRagEvalEvaluationSlice = (
  set: Setter,
  get: () => SourceSetStore,
  _api?: unknown,
) => new RAGEvalEvaluationActionImpl(set, get, _api);

export class RAGEvalEvaluationActionImpl {
  readonly #get: () => SourceSetStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => SourceSetStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  checkEvaluationStatus = async (id: string): Promise<void> => {
    await ragEvalService.checkEvaluationStatus(id);
  };

  createNewEvaluation = async (params: CreateNewEvalEvaluation): Promise<void> => {
    await ragEvalService.createEvaluation(params);
    await this.#get().refreshEvaluationList();
  };

  refreshEvaluationList = async (): Promise<void> => {
    await mutate(FETCH_EVALUATION_LIST_KEY);
  };

  removeEvaluation = async (id: string): Promise<void> => {
    await ragEvalService.removeEvaluation(id);
    // await this.#get().refreshEvaluationList();
  };

  runEvaluation = async (id: string): Promise<void> => {
    await ragEvalService.startEvaluationTask(id);
  };

  useFetchEvaluationList = (sourceSetId: string): SWRResponse<RAGEvalDataSetItem[]> => {
    return useClientDataSWR<RAGEvalDataSetItem[]>(
      [FETCH_EVALUATION_LIST_KEY, sourceSetId],
      () => ragEvalService.getEvaluationList(sourceSetId),
      {
        fallbackData: [],
        onSuccess: () => {
          if (!this.#get().initDatasetList)
            this.#set({ initDatasetList: true }, false, 'useFetchDatasets/init');
        },
      },
    );
  };
}

export type RAGEvalEvaluationAction = Pick<
  RAGEvalEvaluationActionImpl,
  keyof RAGEvalEvaluationActionImpl
>;
