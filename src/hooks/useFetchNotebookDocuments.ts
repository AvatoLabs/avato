import { notebookSelectors } from '@/store/notebook/selectors';
import { useNotebookStore } from '@/store/notebook/store';

/**
 * Fetch notebook documents for the current topic
 */
export const useFetchNotebookDocuments = (topicId?: string) => {
  const useFetchDocuments = useNotebookStore((s) => s.useFetchDocuments);
  const documents = useNotebookStore((s) => notebookSelectors.getDocumentsByTopicId(topicId)(s));

  const { isLoading } = useFetchDocuments(topicId);

  return {
    documents,
    isLoading,
    topicId,
  };
};
