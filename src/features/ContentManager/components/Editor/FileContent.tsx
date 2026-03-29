'use client';

import { Flexbox } from '@lobehub/ui';
import { memo, useMemo } from 'react';

import { useConversationStore } from '@/features/Conversation';
import FileViewer from '@/features/FileViewer';
import { messageMapKey } from '@/store/chat/utils/messageMapKey';
import { fileManagerSelectors, useFileStore } from '@/store/file';

interface FilePreviewerProps {
  fileId?: string;
}

const FilePreviewer = memo<FilePreviewerProps>(({ fileId }) => {
  const useFetchKnowledgeItem = useFileStore((s) => s.useFetchKnowledgeItem);
  const { data: fetchedFile } = useFetchKnowledgeItem(fileId);
  const file = useFileStore(fileManagerSelectors.getFileById(fileId));
  const conversationContext = useConversationStore((s) => s.context);

  const displayFile = file || fetchedFile;
  const docsAgentContextKey = useMemo(
    () => messageMapKey(conversationContext),
    [conversationContext],
  );

  if (!fileId || !displayFile) return null;

  return (
    <Flexbox height={'100%'} width={'100%'}>
      <Flexbox flex={1} height={'100%'} style={{ overflow: 'auto' }}>
        <FileViewer
          {...displayFile}
          enableDocsAgentContext
          docsAgentContextKey={docsAgentContextKey}
        />
      </Flexbox>
    </Flexbox>
  );
});

FilePreviewer.displayName = 'FilePreviewer';

export default FilePreviewer;
