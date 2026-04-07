import { isCanonicalDocumentResource } from '@lobechat/types';

interface CanonicalDocumentEntryParams {
  id: string;
  sourceType?: string | null;
}

export const isCanonicalDocumentEntry = ({ id, sourceType }: CanonicalDocumentEntryParams) => {
  return isCanonicalDocumentResource({
    id,
    sourceType: sourceType === 'document' ? 'document' : 'file',
  });
};
