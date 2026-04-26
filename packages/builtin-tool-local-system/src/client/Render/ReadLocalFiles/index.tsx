import type { LocalReadFilesState } from '@lobechat/builtin-tool-local-system';
import type { LocalReadFilesParams } from '@lobechat/electron-client-ipc';
import type { ChatMessagePluginError } from '@lobechat/types';
import { Flexbox } from '@lobehub/ui';
import { memo } from 'react';

import { useChatStore } from '@/store/chat';
import { chatToolSelectors } from '@/store/chat/slices/builtinTool/selectors';

import ReadFileSkeleton from '../ReadLocalFile/ReadFileSkeleton';
import ReadFileView from '../ReadLocalFile/ReadFileView';

interface ReadFilesQueryProps {
  args: LocalReadFilesParams;
  messageId: string;
  pluginError: ChatMessagePluginError;
  pluginState: LocalReadFilesState;
}

const ReadFilesQuery = memo<ReadFilesQueryProps>(({ args, pluginState, messageId }) => {
  const loading = useChatStore(chatToolSelectors.isSearchingLocalFiles(messageId));

  if (loading) {
    return <ReadFileSkeleton />;
  }

  const filesContent = pluginState?.filesContent || [];
  const paths = Array.isArray(args?.paths) ? args.paths : [];
  if (paths.length === 0 || filesContent.length === 0) return null;

  return (
    <Flexbox gap={8}>
      {filesContent.map((fileContent, index) => {
        const filePath = paths[index] || fileContent.filename;

        return <ReadFileView key={`${filePath}-${index}`} {...fileContent} path={filePath} />;
      })}
    </Flexbox>
  );
});

export default ReadFilesQuery;
