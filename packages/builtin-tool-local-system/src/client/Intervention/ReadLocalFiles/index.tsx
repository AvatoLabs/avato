import type { LocalReadFilesParams } from '@lobechat/electron-client-ipc';
import type { BuiltinInterventionProps } from '@lobechat/types';
import { Flexbox, Icon } from '@lobehub/ui';
import { ChevronRight } from 'lucide-react';
import path from 'path-browserify-esm';
import { memo } from 'react';

import { LocalFile, LocalFolder } from '@/features/LocalFile';

import OutOfScopeWarning from '../OutOfScopeWarning';

const ReadLocalFiles = memo<BuiltinInterventionProps<LocalReadFilesParams>>(({ args }) => {
  const paths = Array.isArray(args.paths) ? args.paths : [];

  return (
    <Flexbox gap={12}>
      <OutOfScopeWarning paths={paths} />
      <Flexbox gap={8}>
        {paths.map((filePath, index) => {
          const { base, dir } = path.parse(filePath || '');

          return (
            <Flexbox horizontal key={`${filePath}-${index}`}>
              <LocalFolder path={dir} />
              <Icon icon={ChevronRight} />
              <LocalFile name={base} path={filePath} />
            </Flexbox>
          );
        })}
      </Flexbox>
    </Flexbox>
  );
});

ReadLocalFiles.displayName = 'ReadLocalFilesIntervention';

export default ReadLocalFiles;
