import {
  type CreateNewEvalDatasets,
  type CreateNewEvalEvaluation,
  type EvalDatasetRecord,
  type insertEvalDatasetsSchema,
  type RAGEvalDataSetItem,
  type RAGEvalEvaluationItem,
} from '@lobechat/types';
import { sha256 } from 'js-sha256';

import { lambdaClient } from '@/libs/trpc/client';
import { uploadService } from '@/services/upload';

class RAGEvalService {
  // Dataset
  createDataset = async (params: CreateNewEvalDatasets): Promise<string | undefined> => {
    return lambdaClient.ragEval.createDataset.mutate(params);
  };

  getDatasets = async (knowledgeBaseId: string): Promise<RAGEvalDataSetItem[]> => {
    return lambdaClient.ragEval.getDatasets.query({ knowledgeBaseId });
  };

  removeDataset = async (id: string): Promise<void> => {
    await lambdaClient.ragEval.removeDataset.mutate({ id });
  };

  updateDataset = async (
    id: string,
    value: Partial<typeof insertEvalDatasetsSchema>,
  ): Promise<void> => {
    await lambdaClient.ragEval.updateDataset.mutate({ id, value });
  };

  // Dataset Records
  getDatasetRecords = async (datasetId: string): Promise<EvalDatasetRecord[]> => {
    return lambdaClient.ragEval.getDatasetRecords.query({ datasetId });
  };

  removeDatasetRecord = async (id: string): Promise<void> => {
    await lambdaClient.ragEval.removeDatasetRecords.mutate({ id });
  };

  importDatasetRecords = async (datasetId: string, file: File): Promise<void> => {
    const buf = await file.arrayBuffer();
    const digest = sha256(buf);
    const { path } = await uploadService.uploadToServerS3(
      new File([buf], file.name, { type: file.type }),
      { directory: 'ragEval', sha256: digest },
    );

    await lambdaClient.ragEval.importDatasetRecords.mutate({ datasetId, pathname: path });
  };

  // Evaluation
  createEvaluation = async (params: CreateNewEvalEvaluation): Promise<string | undefined> => {
    return lambdaClient.ragEval.createEvaluation.mutate(params);
  };

  getEvaluationList = async (knowledgeBaseId: string): Promise<RAGEvalEvaluationItem[]> => {
    return lambdaClient.ragEval.getEvaluationList.query({ knowledgeBaseId });
  };

  startEvaluationTask = async (id: string) => {
    return lambdaClient.ragEval.startEvaluationTask.mutate({ id });
  };

  removeEvaluation = async (id: string): Promise<void> => {
    await lambdaClient.ragEval.removeEvaluation.mutate({ id });
  };

  checkEvaluationStatus = async (id: string): Promise<{ success: boolean }> => {
    return lambdaClient.ragEval.checkEvaluationStatus.query({ id });
  };
}

export const ragEvalService = new RAGEvalService();
