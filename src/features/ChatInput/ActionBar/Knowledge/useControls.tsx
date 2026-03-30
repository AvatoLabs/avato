import { type ItemType } from '@lobehub/ui';
import { Icon } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { ArrowRight, LibraryBig } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import FileIcon from '@/components/FileIcon';
import RepoIcon from '@/components/LibIcon';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { useAgentStore } from '@/store/agent/store';

import { useAgentId } from '../../hooks/useAgentId';
import CheckboxItem from '../components/CheckboxWithLoading';

export const useControls = ({
  setModalOpen,
  setUpdating,
}: {
  setModalOpen: (open: boolean) => void;
  setUpdating: (updating: boolean) => void;
}) => {
  const { t } = useTranslation('chat');
  const agentId = useAgentId();

  const files = useAgentStore((s) => agentByIdSelectors.getAgentFilesById(agentId)(s), isEqual);
  const sourceSets = useAgentStore(
    (s) => agentByIdSelectors.getAgentSourceSetsById(agentId)(s),
    isEqual,
  );

  const [toggleFile, setSourceSetEnabled] = useAgentStore((s) => [
    s.toggleFile,
    s.setSourceSetEnabled,
  ]);

  const items: ItemType[] = [
    {
      children: [
        // first the files
        ...files.map((item) => ({
          icon: <FileIcon fileName={item.name} fileType={item.type} size={20} />,
          key: item.id,
          label: (
            <CheckboxItem
              checked={item.enabled}
              id={item.id}
              label={item.name}
              onUpdate={async (id, enabled) => {
                setUpdating(true);
                await toggleFile(id, enabled);
                setUpdating(false);
              }}
            />
          ),
        })),

        // then the source sets
        ...sourceSets.map((item) => ({
          icon: <RepoIcon />,
          key: item.id,
          label: (
            <CheckboxItem
              checked={item.enabled}
              id={item.id}
              label={item.name}
              onUpdate={async (id, enabled) => {
                setUpdating(true);
                await setSourceSetEnabled(id, enabled);
                setUpdating(false);
              }}
            />
          ),
        })),
      ],
      key: 'relatedSources',
      label: t('sourceSet.relatedSources'),
      type: 'group',
    },
    {
      type: 'divider',
    },
    {
      extra: <Icon icon={ArrowRight} />,
      icon: LibraryBig,
      key: 'source-set-store',
      label: t('sourceSet.viewMore'),
      onClick: () => {
        setModalOpen(true);
      },
    },
  ];

  return items;
};
