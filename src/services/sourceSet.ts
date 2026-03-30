import { lambdaClient } from '@/libs/trpc/client';
import { type CreateSourceSetParams } from '@/types/sourceSet';

class SourceSetService {
  createSourceSet = async (params: CreateSourceSetParams) => {
    return lambdaClient.sourceSet.createSourceSet.mutate(params);
  };

  getSourceSets = async (spaceId?: string) => {
    return lambdaClient.sourceSet.getSourceSets.query(spaceId ? { spaceId } : undefined);
  };

  getSourceSetById = async (id: string) => {
    return lambdaClient.sourceSet.getSourceSetById.query({ id });
  };

  updateSourceSet = async (id: string, value: any) => {
    return lambdaClient.sourceSet.updateSourceSet.mutate({ id, value });
  };

  deleteSourceSet = async (id: string) => {
    return lambdaClient.sourceSet.deleteSourceSet.mutate({ id });
  };

  addFilesToSourceSet = async (sourceSetId: string, ids: string[]) => {
    return lambdaClient.sourceSet.addFilesToSourceSet.mutate({ ids, sourceSetId });
  };

  removeFilesFromSourceSet = async (sourceSetId: string, ids: string[]) => {
    return lambdaClient.sourceSet.removeFilesFromSourceSet.mutate({ ids, sourceSetId });
  };
}

export const sourceSetService = new SourceSetService();
