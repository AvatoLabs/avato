import { useUserMemoryStore } from '@/store/userMemory';

export const useFetchTopicMemories = (params?: {
  effort?: 'high' | 'low' | 'medium';
  latestUserMessageId?: string;
  topicId?: string | null;
  userMessageCount?: number;
}) => {
  const useFetchMemoriesForTopicWithOptions = useUserMemoryStore(
    (s) => s.useFetchMemoriesForTopicWithOptions,
  );

  useFetchMemoriesForTopicWithOptions(params?.topicId, {
    effort: params?.effort,
    latestUserMessageId: params?.latestUserMessageId,
    userMessageCount: params?.userMessageCount,
  });
};
