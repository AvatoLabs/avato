import { Flexbox, Highlighter } from '@lobehub/ui';
import { memo, useCallback } from 'react';

import { LOADING_FLAT } from '@/const/message';
import { useErrorContent } from '@/features/Conversation/Error';
import SearchGrounding from '@/features/Conversation/Messages/components/SearchGrounding';
import { type AssistantContentBlock } from '@/types/index';

import ErrorContent from '../../../ChatItem/components/ErrorContent';
import { messageStateSelectors, useConversationStore } from '../../../store';
import FileChunks from '../../components/FileChunks';
import ImageFileListViewer from '../../components/ImageFileListViewer';
import Reasoning from '../../components/Reasoning';
import { Tools } from '../Tools';
import MessageContent from './MessageContent';

interface ContentBlockProps extends AssistantContentBlock {
  assistantId: string;
  disableEditing?: boolean;
}
const ContentBlock = memo<ContentBlockProps>(
  ({
    id,
    tools,
    content,
    imageList,
    reasoning,
    error,
    assistantId,
    disableEditing,
    search,
    chunksList,
  }) => {
    const errorContent = useErrorContent(error);
    const showImageItems = !!imageList && imageList.length > 0;
    const showFileChunks = !!chunksList && chunksList.length > 0;
    const [isReasoning, deleteMessage, continueGeneration] = useConversationStore((s) => [
      messageStateSelectors.isMessageInReasoning(id)(s),
      s.deleteDBMessage,
      s.continueGeneration,
    ]);
    const hasTools = tools && tools.length > 0;
    const showReasoning =
      (!!reasoning && reasoning.content?.trim() !== '') || (!reasoning && isReasoning);
    const showSearch = !!search && (!!search.citations?.length || !!search.imageResults?.length);

    const handleRegenerate = useCallback(async () => {
      await deleteMessage(id);
      continueGeneration(assistantId);
    }, [assistantId, continueGeneration, deleteMessage, id]);

    if (error && (content === LOADING_FLAT || !content)) {
      return (
        <ErrorContent
          id={id}
          error={
            errorContent && error && (content === LOADING_FLAT || !content)
              ? {
                  ...errorContent,
                  extra: error?.body && (
                    <Highlighter
                      actionIconSize={'small'}
                      language={'json'}
                      padding={8}
                      variant={'borderless'}
                    >
                      {JSON.stringify(error?.body, null, 2)}
                    </Highlighter>
                  ),
                }
              : undefined
          }
          onRegenerate={handleRegenerate}
        />
      );
    }

    return (
      <Flexbox gap={8} id={id}>
        {showSearch && (
          <SearchGrounding
            citations={search?.citations}
            imageResults={search?.imageResults}
            imageSearchQueries={search?.imageSearchQueries}
            searchQueries={search?.searchQueries}
          />
        )}
        {showFileChunks && <FileChunks data={chunksList} />}
        {showReasoning && <Reasoning {...reasoning} id={id} />}

        {/* Content - markdown text */}
        <MessageContent content={content} hasTools={hasTools} id={id} />

        {/* Image files */}
        {showImageItems && <ImageFileListViewer items={imageList} />}

        {/* Tools */}
        {hasTools && <Tools disableEditing={disableEditing} messageId={id} tools={tools} />}
      </Flexbox>
    );
  },
);

export default ContentBlock;
