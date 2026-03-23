'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { useTranslation } from 'react-i18next';

import { useImageStore } from '@/store/image';
import { generationBatchSelectors, generationTopicSelectors } from '@/store/image/selectors';

import GenerationFeed from '../GenerationFeed';
import PromptInput from '../PromptInput';
import EmptyState from './EmptyState';
import SkeletonList from './SkeletonList';

const ImageWorkspaceContent = () => {
  const { t } = useTranslation('image');
  const activeTopicId = useImageStore(generationTopicSelectors.activeGenerationTopicId);
  const activeTopic = useImageStore((s) =>
    activeTopicId ? generationTopicSelectors.getGenerationTopicById(activeTopicId)(s) : undefined,
  );
  const useFetchGenerationBatches = useImageStore((s) => s.useFetchGenerationBatches);
  const isCurrentGenerationTopicLoaded = useImageStore(
    generationBatchSelectors.isCurrentGenerationTopicLoaded,
  );
  useFetchGenerationBatches(activeTopicId);
  const currentBatches = useImageStore(generationBatchSelectors.currentGenerationBatches);
  const hasGenerations = currentBatches && currentBatches.length > 0;

  const topicDisplayTitle =
    activeTopic?.title && activeTopic.title.trim().length > 0
      ? activeTopic.title.trim()
      : t('topic.untitled');

  if (!isCurrentGenerationTopicLoaded) {
    return <SkeletonList />;
  }

  if (!hasGenerations) return <EmptyState emptyHint={'topicEmpty'} />;

  return (
    <Flexbox vertical flex={1} height={'100%'} style={{ minHeight: 0 }} width={'100%'}>
      <Flexbox
        horizontal
        align={'center'}
        gap={8}
        paddingBlock={8}
        style={{ flex: 'none', minWidth: 0 }}
        width={'100%'}
      >
        <Text size={'small'} style={{ flex: 'none' }} type={'secondary'}>
          {t('workspace.activeTopic')}
        </Text>
        <Flexbox flex={1} style={{ minWidth: 0 }} width={'100%'}>
          <Text ellipsis strong title={topicDisplayTitle}>
            {topicDisplayTitle}
          </Text>
        </Flexbox>
      </Flexbox>
      <GenerationFeed key={activeTopicId} />
      <PromptInput disableAnimation={true} showTitle={false} />
    </Flexbox>
  );
};

export default ImageWorkspaceContent;
