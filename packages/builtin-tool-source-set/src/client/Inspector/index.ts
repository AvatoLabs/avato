import { SourceSetApiName } from '../../types';
import { ReadSourceFilesInspector } from './ReadSourceFiles';
import { SearchSourceSetInspector } from './SearchSourceSet';

/**
 * Source-set inspector components registry
 */
export const SourceSetInspectors = {
  [SourceSetApiName.readSourceFiles]: ReadSourceFilesInspector,
  [SourceSetApiName.searchSourceSet]: SearchSourceSetInspector,
};
