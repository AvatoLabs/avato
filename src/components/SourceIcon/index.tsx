import { Center } from '@lobehub/ui';
import { memo } from 'react';

import FileIcon from '@/components/FileIcon';
import RepoIcon from '@/components/LibIcon';
import { AgentSourceKind } from '@/types/sourceSet';

interface SourceIconProps {
  fileType?: string;
  name: string;
  size?: number | { file?: number; repo?: number };
  type: AgentSourceKind;
}

const SourceIcon = memo<SourceIconProps>(({ type, size, fileType, name }) => {
  const repoSize = (typeof size === 'object' ? size.repo : size) || 24;
  const fileSize = (typeof size === 'object' ? size.file : size) || 24;

  return type === AgentSourceKind.SourceSet ? (
    <Center height={repoSize} width={repoSize}>
      <RepoIcon size={repoSize / 1.2} />
    </Center>
  ) : (
    <FileIcon fileName={name} fileType={fileType!} size={fileSize} />
  );
});

export default SourceIcon;
