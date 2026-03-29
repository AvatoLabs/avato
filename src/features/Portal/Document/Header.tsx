'use client';

import { Button, Flexbox, Tag, Text } from '@lobehub/ui';
import { cx } from 'antd-style';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useSpaceName } from '@/features/ResourceSpaces/useSpaceName';
import { documentService } from '@/services/document';
import { useChatStore } from '@/store/chat';
import { chatPortalSelectors } from '@/store/chat/selectors';
import { notebookSelectors } from '@/store/notebook/selectors';
import { useNotebookStore } from '@/store/notebook/store';
import { oneLineEllipsis } from '@/styles';
import { isPageEntryFileType } from '@/utils/docsDocument';
import { standardizeIdentifier } from '@/utils/identifier';

import AutoSaveHint from './AutoSaveHint';

const Header = () => {
  const { t } = useTranslation('portal');
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [topicId, documentId] = useChatStore((s) => [
    s.activeTopicId,
    chatPortalSelectors.portalDocumentId(s),
  ]);

  const [useFetchDocuments, title, fileType, spaceId] = useNotebookStore((s) => [
    s.useFetchDocuments,
    notebookSelectors.getDocumentById(topicId, documentId)(s)?.title,
    notebookSelectors.getDocumentById(topicId, documentId)(s)?.fileType,
    notebookSelectors.getDocumentById(topicId, documentId)(s)?.spaceId,
  ]);
  useFetchDocuments(topicId);
  const spaceName = useSpaceName(spaceId);

  const handleOpenInDocEditor = async () => {
    if (!documentId) return;

    setLoading(true);
    try {
      if (!isPageEntryFileType(fileType)) {
        await documentService.updateDocument({
          fileType: 'custom/document',
          id: documentId,
        });
      }

      navigate(`/docs/${standardizeIdentifier(documentId)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!title) return null;

  return (
    <Flexbox horizontal align={'center'} flex={1} gap={12} justify={'space-between'} width={'100%'}>
      <Flexbox flex={1}>
        <Flexbox horizontal align={'center'} gap={8} style={{ minWidth: 0 }}>
          {spaceName && <Tag size={'small'}>{spaceName}</Tag>}
          <Text className={cx(oneLineEllipsis)} type={'secondary'}>
            {title}
          </Text>
        </Flexbox>
      </Flexbox>
      <Flexbox horizontal align={'center'} gap={8}>
        <AutoSaveHint />
        {fileType !== 'agent/plan' && (
          <Button
            icon={<ExternalLink size={14} />}
            loading={loading}
            size={'small'}
            type={'text'}
            onClick={handleOpenInDocEditor}
          >
            {t('openInDocEditor')}
          </Button>
        )}
      </Flexbox>
    </Flexbox>
  );
};

export default Header;
