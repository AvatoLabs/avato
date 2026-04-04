'use client';

import {
  spaceMemoryCategories,
  type SpaceMemoryCategory,
  type SpaceMemorySourceRefPreview,
} from '@lobechat/types';
import { Button, Flexbox, Segmented, Tag, Text } from '@lobehub/ui';
import { createModal, useModalContext } from '@lobehub/ui/base-ui';
import { App, Input, Select } from 'antd';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSWRConfig } from 'swr';

import { lambdaClient } from '@/libs/trpc/client';

import { useSpaceMemoryCandidateTargets } from './useSpaceMemoryCandidateTargets';

interface CreateSpaceMemoryCandidateParams {
  defaultSummary?: string;
  defaultTitle?: string;
  initialSpaceId?: string;
  onCreated?: () => void;
  sourceRefs: SpaceMemorySourceRefPreview[];
  spaceId?: string;
}

interface ModalContentProps extends CreateSpaceMemoryCandidateParams {}

const renderSourceLabel = (
  source: SpaceMemorySourceRefPreview,
  t: (key: string, options?: any) => string,
) => {
  if (source.title?.trim()) return source.title;

  return t(`space.memory.sources.${source.kind}`, {
    defaultValue: source.kind,
    ns: 'file',
  });
};

const ModalContent = memo<ModalContentProps>(
  ({ defaultSummary, defaultTitle, initialSpaceId, onCreated, sourceRefs, spaceId }) => {
    const { t } = useTranslation('file');
    const { message } = App.useApp();
    const { mutate } = useSWRConfig();
    const { close } = useModalContext();
    const hasFixedSpace = Boolean(spaceId);
    const { teamSpaces } = useSpaceMemoryCandidateTargets(initialSpaceId);
    const [title, setTitle] = useState(defaultTitle ?? '');
    const [summary, setSummary] = useState(defaultSummary ?? '');
    const [category, setCategory] = useState<SpaceMemoryCategory>('general');
    const [selectedSpaceId, setSelectedSpaceId] = useState(
      spaceId ?? initialSpaceId ?? teamSpaces[0]?.id ?? '',
    );
    const [creating, setCreating] = useState(false);
    const targetSpaceId = spaceId ?? selectedSpaceId;

    useEffect(() => {
      if (hasFixedSpace) return;

      if (!teamSpaces.length) {
        if (selectedSpaceId) setSelectedSpaceId('');
        return;
      }

      if (!selectedSpaceId || !teamSpaces.some((space) => space.id === selectedSpaceId)) {
        setSelectedSpaceId(initialSpaceId ?? teamSpaces[0]?.id ?? '');
      }
    }, [hasFixedSpace, initialSpaceId, selectedSpaceId, teamSpaces]);

    const sourceTags = useMemo(
      () =>
        sourceRefs.map((source) => (
          <Tag key={`${source.kind}:${source.id}`} size={'small'} variant={'outlined'}>
            {renderSourceLabel(source, t)}
          </Tag>
        )),
      [sourceRefs, t],
    );

    const spaceOptions = useMemo(
      () =>
        teamSpaces.map((space) => ({
          label: space.name,
          value: space.id,
        })),
      [teamSpaces],
    );

    const handleSubmit = useCallback(async () => {
      const nextTitle = title.trim();
      if (!nextTitle) {
        message.warning(t('space.memory.actions.createTitleRequired'));
        return;
      }

      if (!targetSpaceId) {
        message.warning(t('space.memory.actions.createSpaceRequired'));
        return;
      }

      try {
        setCreating(true);

        await lambdaClient.spaceMemory.createCandidate.mutate({
          category,
          sourceRefs,
          spaceId: targetSpaceId,
          summary: summary.trim() || undefined,
          title: nextTitle,
        });

        await Promise.all([
          mutate(['space-memory-summary', targetSpaceId]),
          mutate(['space-memory-section', targetSpaceId, 'inbox']),
        ]);

        message.success(t('space.memory.actions.createSuccess'));
        onCreated?.();
        close();
      } catch {
        message.error(t('space.memory.actions.createError'));
      } finally {
        setCreating(false);
      }
    }, [category, close, message, mutate, onCreated, sourceRefs, summary, t, targetSpaceId, title]);

    return (
      <Flexbox gap={16}>
        <Flexbox gap={4}>
          <Text type={'secondary'}>{t('space.memory.composer.description')}</Text>
        </Flexbox>

        {!hasFixedSpace && (
          <Flexbox gap={8}>
            <Text size={'small'} type={'secondary'}>
              {t('space.memory.composer.spaceLabel')}
            </Text>
            <Select
              options={spaceOptions}
              placeholder={t('space.memory.composer.spacePlaceholder')}
              value={selectedSpaceId || undefined}
              onChange={setSelectedSpaceId}
            />
          </Flexbox>
        )}

        <Flexbox gap={8}>
          <Text size={'small'} type={'secondary'}>
            {t('space.memory.composer.sourceLabel')}
          </Text>
          <Flexbox horizontal gap={8} wrap={'wrap'}>
            {sourceTags}
          </Flexbox>
          <Text size={'small'} type={'secondary'}>
            {t('space.memory.composer.sourceHint')}
          </Text>
        </Flexbox>

        <Flexbox gap={8}>
          <Text size={'small'} type={'secondary'}>
            {t('space.memory.composer.titleLabel')}
          </Text>
          <Input
            aria-label={t('space.memory.composer.titleLabel')}
            maxLength={255}
            placeholder={t('space.memory.composer.titlePlaceholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </Flexbox>

        <Flexbox gap={8}>
          <Text size={'small'} type={'secondary'}>
            {t('space.memory.composer.summaryLabel')}
          </Text>
          <Input.TextArea
            aria-label={t('space.memory.composer.summaryLabel')}
            autoSize={{ maxRows: 5, minRows: 3 }}
            maxLength={1000}
            placeholder={t('space.memory.composer.summaryPlaceholder')}
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </Flexbox>

        <Flexbox gap={8}>
          <Text size={'small'} type={'secondary'}>
            {t('space.memory.composer.categoryLabel')}
          </Text>
          <Segmented
            block
            value={category}
            options={spaceMemoryCategories.map((item) => ({
              label: t(`space.memory.categories.${item}`),
              value: item,
            }))}
            onChange={(value) => setCategory(value as SpaceMemoryCategory)}
          />
        </Flexbox>

        <Flexbox horizontal justify={'flex-end'}>
          <Button loading={creating} type={'primary'} onClick={handleSubmit}>
            {t('space.memory.actions.addFromSource')}
          </Button>
        </Flexbox>
      </Flexbox>
    );
  },
);

ModalContent.displayName = 'CreateSpaceMemoryCandidateModalContent';

export const useOpenCreateSpaceMemoryCandidateModal = () => {
  const { t } = useTranslation('file');

  return useCallback(
    (params: CreateSpaceMemoryCandidateParams) => {
      createModal({
        children: <ModalContent {...params} />,
        footer: null,
        title: t('space.memory.actions.addFromSource'),
        width: 520,
      });
    },
    [t],
  );
};
