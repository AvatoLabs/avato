'use client';

import {
  spaceMemoryCategories,
  type SpaceMemoryCategory,
  type SpaceMemorySection,
  spaceMemorySections,
} from '@lobechat/types';
import { Block, Button, Flexbox, Segmented, Tag, Text } from '@lobehub/ui';
import { App, Input } from 'antd';
import { createStyles } from 'antd-style';
import { InboxIcon, LibraryBigIcon, ScrollTextIcon, ShieldCheckIcon } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';

import Loading from '@/components/Loading/BrandTextLoading';
import { useIsMobile } from '@/hooks/useIsMobile';
import { lambdaClient } from '@/libs/trpc/client';
import { useUserStore } from '@/store/user';
import { userProfileSelectors } from '@/store/user/slices/auth/selectors';

import MemoryScopeSection from './MemoryScopeSection';
import { buildSpaceRootPath } from './paths';
import { resolveSpaceDisplayName } from './resolveSpaceDisplayName';
import SurfaceBreadcrumb from './SurfaceBreadcrumb';

const useStyles = createStyles(({ css, token }) => ({
  memoryEntry: css`
    min-width: 0;
    padding: 16px 18px;
    border: 1px solid ${token.colorBorderSecondary};
    border-radius: ${token.borderRadiusLG}px;
    background: ${token.colorBgContainer};
  `,
  memoryEntryList: css`
    display: grid;
    gap: 12px;
  `,
  sourceRefList: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  page: css`
    overflow: auto;
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 28px;

    @media (max-width: 640px) {
      padding: 20px 16px;
    }
  `,
  scopeRail: css`
    position: sticky;
    inset-block-start: 0;
    flex: none;
    width: 248px;
    align-self: flex-start;
  `,
}));

const SpaceMemoryPage = memo(() => {
  const { t } = useTranslation(['common', 'file']);
  const { styles } = useStyles();
  const { message } = App.useApp();
  const { mutate } = useSWRConfig();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftCategory, setDraftCategory] = useState<SpaceMemoryCategory>('general');
  const { spaceId } = useParams<{ spaceId?: string }>();
  const username = useUserStore(userProfileSelectors.username);
  const fullName = useUserStore(userProfileSelectors.fullName);
  const isMobile = useIsMobile();

  const { data: summary, isLoading } = useSWR(
    spaceId ? ['space-memory-summary', spaceId] : null,
    () => lambdaClient.spaceMemory.getSummary.query({ spaceId: spaceId! }),
    { revalidateOnFocus: false },
  );

  const sections = [
    {
      description: t('space.memory.sections.inbox.description', { ns: 'file' }),
      icon: InboxIcon,
      key: 'inbox',
      title: t('space.memory.sections.inbox.title', { ns: 'file' }),
    },
    {
      description: t('space.memory.sections.published.description', { ns: 'file' }),
      icon: LibraryBigIcon,
      key: 'published',
      title: t('space.memory.sections.published.title', { ns: 'file' }),
    },
    {
      description: t('space.memory.sections.playbooks.description', { ns: 'file' }),
      icon: ScrollTextIcon,
      key: 'playbooks',
      title: t('space.memory.sections.playbooks.title', { ns: 'file' }),
    },
    {
      description: t('space.memory.sections.policies.description', { ns: 'file' }),
      icon: ShieldCheckIcon,
      key: 'policies',
      title: t('space.memory.sections.policies.title', { ns: 'file' }),
    },
  ] as {
    description: string;
    icon: typeof InboxIcon;
    key: SpaceMemorySection;
    title: string;
  }[];
  const sectionParam = searchParams.get('section');
  const requestedSection = spaceMemorySections.includes(sectionParam as SpaceMemorySection)
    ? (sectionParam as SpaceMemorySection)
    : 'inbox';
  const visibleSections = !summary
    ? sections
    : summary.canReview
      ? sections
      : sections.filter((item) => item.key !== 'inbox');
  const fallbackSection = visibleSections[0]?.key ?? 'published';
  const section = visibleSections.some((item) => item.key === requestedSection)
    ? requestedSection
    : fallbackSection;
  const activeSection = visibleSections.find((item) => item.key === section) ?? sections[0];
  const { data: sectionEntries } = useSWR(
    spaceId && summary ? ['space-memory-section', spaceId, section] : null,
    () =>
      lambdaClient.spaceMemory.listEntries.query({
        section,
        spaceId: spaceId!,
      }),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    if (!summary) return;
    if (sectionParam === section) return;

    const next = new URLSearchParams(searchParams);
    next.set('section', section);
    setSearchParams(next, { replace: true });
  }, [searchParams, section, sectionParam, setSearchParams, summary]);

  if (!spaceId) return null;
  if (isLoading) return <Loading debugId="SpaceMemoryPage" />;
  if (!summary) return null;

  const isTeamSpace = summary.kind === 'team';
  const canReview = summary.canReview;
  const canCreate = summary.canCreate;
  const displayName = resolveSpaceDisplayName(summary, t, { fullName, username });
  const entryList = sectionEntries?.items ?? [];

  if (!isTeamSpace) {
    return (
      <Flexbox className={styles.page} gap={24} horizontal={!isMobile}>
        {!isMobile && (
          <Block className={styles.scopeRail} padding={12} variant={'outlined'}>
            <MemoryScopeSection currentScope="personal" />
          </Block>
        )}

        <Flexbox flex={1} gap={24} style={{ minWidth: 0 }}>
          <SurfaceBreadcrumb
            segments={[
              {
                key: 'space',
                label: displayName,
                onClick: () => navigate(buildSpaceRootPath(summary.id)),
              },
              {
                current: true,
                key: 'memory',
                label: t('space.memory.title', { ns: 'file' }),
              },
            ]}
          />

          <Flexbox gap={10}>
            <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
              <Text as={'h1'} fontSize={32} style={{ margin: 0 }} weight={700}>
                {t('space.memory.title', { ns: 'file' })}
              </Text>
              <Tag size={'small'} variant={'filled'}>
                {displayName}
              </Tag>
              <Tag size={'small'} variant={'outlined'}>
                {t('space.home.badges.personal', { ns: 'file' })}
              </Tag>
            </Flexbox>
            <Text type={'secondary'}>
              {t('space.memory.personalOnly.subtitle', { ns: 'file' })}
            </Text>
          </Flexbox>

          <Block padding={18} variant={'outlined'}>
            <Flexbox gap={8}>
              <Text strong>{t('space.memory.personalOnly.title', { ns: 'file' })}</Text>
              <Text type={'secondary'}>{t('space.memory.personalOnly.body', { ns: 'file' })}</Text>
              <Text type={'secondary'}>{t('space.memory.personalOnly.hint', { ns: 'file' })}</Text>
              <Flexbox horizontal gap={8} wrap={'wrap'}>
                <Button type={'primary'} onClick={() => navigate('/memory')}>
                  {t('space.memory.actions.openPersonal', { ns: 'file' })}
                </Button>
                <Button onClick={() => navigate(buildSpaceRootPath(summary.id))}>
                  {t('space.settings.back', { ns: 'file' })}
                </Button>
              </Flexbox>
            </Flexbox>
          </Block>
        </Flexbox>
      </Flexbox>
    );
  }

  const refreshMemory = async (sectionsToRefresh: SpaceMemorySection[]) => {
    const keys = new Set(sectionsToRefresh);

    keys.add(section);

    await Promise.all([
      mutate(['space-memory-summary', spaceId]),
      ...[...keys].map((value) => mutate(['space-memory-section', spaceId, value])),
    ]);
  };

  const handlePublish = async (id: string) => {
    if (!spaceId) return;

    try {
      setPublishingId(id);
      await lambdaClient.spaceMemory.publishEntry.mutate({ id, spaceId });
      message.success(t('space.memory.actions.publishSuccess', { ns: 'file' }));
      await refreshMemory(['inbox', 'published']);
    } catch {
      message.error(t('space.memory.actions.publishError', { ns: 'file' }));
    } finally {
      setPublishingId(null);
    }
  };

  const resetDraft = () => {
    setDraftCategory('general');
    setDraftSummary('');
    setDraftTitle('');
  };

  const handleCreateCandidate = async () => {
    if (!spaceId) return;

    const nextTitle = draftTitle.trim();
    if (!nextTitle) {
      message.warning(t('space.memory.actions.createTitleRequired', { ns: 'file' }));
      return;
    }

    try {
      setCreating(true);
      await lambdaClient.spaceMemory.createCandidate.mutate({
        category: draftCategory,
        spaceId,
        summary: draftSummary.trim() || undefined,
        title: nextTitle,
      });
      message.success(t('space.memory.actions.createSuccess', { ns: 'file' }));
      resetDraft();
      await refreshMemory(['inbox']);
    } catch {
      message.error(t('space.memory.actions.createError', { ns: 'file' }));
    } finally {
      setCreating(false);
    }
  };

  const renderSourceLabel = (source: { kind: string; title?: string }) => {
    if (source.title?.trim()) return source.title;

    return t(`space.memory.sources.${source.kind}`, {
      defaultValue: source.kind,
      ns: 'file',
    });
  };

  const renderTimelineLabel = (entry: (typeof entryList)[number]) => {
    const time = new Date(entry.publishedAt ?? entry.updatedAt).toLocaleString();

    if (entry.kind === 'memory' && entry.publishedAt) {
      return t('space.memory.entries.publishedAt', {
        ns: 'file',
        time,
      });
    }

    return t('space.memory.entries.updatedAt', {
      ns: 'file',
      time,
    });
  };

  const renderActorLabel = (entry: (typeof entryList)[number]) => {
    const actorName = entry.actor?.name || entry.actor?.username;

    if (!actorName) return null;

    return t(
      entry.kind === 'candidate'
        ? 'space.memory.entries.createdBy'
        : 'space.memory.entries.publishedBy',
      {
        name: actorName,
        ns: 'file',
      },
    );
  };

  return (
    <Flexbox className={styles.page} gap={24} horizontal={!isMobile}>
      {!isMobile && (
        <Block className={styles.scopeRail} padding={12} variant={'outlined'}>
          <MemoryScopeSection activeSpaceId={summary.id} currentScope="space" />
        </Block>
      )}

      <Flexbox flex={1} gap={24} style={{ minWidth: 0 }}>
        <SurfaceBreadcrumb
          segments={[
            {
              key: 'space',
              label: displayName,
              onClick: () => navigate(buildSpaceRootPath(summary.id)),
            },
            {
              current: true,
              key: 'memory',
              label: t('space.memory.title', { ns: 'file' }),
            },
          ]}
        />

        <Flexbox gap={10}>
          <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
            <Text as={'h1'} fontSize={32} style={{ margin: 0 }} weight={700}>
              {t('space.memory.title', { ns: 'file' })}
            </Text>
            <Tag size={'small'} variant={'filled'}>
              {displayName}
            </Tag>
            <Tag size={'small'} variant={'outlined'}>
              {t(isTeamSpace ? 'space.home.badges.team' : 'space.home.badges.personal', {
                ns: 'file',
              })}
            </Tag>
          </Flexbox>
          <Text type={'secondary'}>
            {t(isTeamSpace ? 'space.memory.subtitle.team' : 'space.memory.subtitle.personal', {
              ns: 'file',
            })}
          </Text>
        </Flexbox>

        <Block padding={18} variant={'outlined'}>
          <Flexbox gap={8}>
            <Text strong>{t('space.memory.overview.title', { ns: 'file' })}</Text>
            <Text type={'secondary'}>
              <Trans i18nKey={'space.memory.overview.body'} ns={'file'} />
            </Text>
            <Text type={'secondary'}>
              {t(
                !isTeamSpace
                  ? 'space.memory.overview.mode.personal'
                  : canReview
                    ? 'space.memory.overview.mode.reviewer'
                    : 'space.memory.overview.mode.viewer',
                { ns: 'file' },
              )}
            </Text>
            {!isTeamSpace && (
              <Flexbox horizontal gap={8}>
                <Button type={'primary'} onClick={() => navigate('/memory')}>
                  {t('space.memory.actions.openPersonal', { ns: 'file' })}
                </Button>
              </Flexbox>
            )}
          </Flexbox>
        </Block>

        <Flexbox gap={12}>
          <Segmented
            block
            value={section}
            variant={'filled'}
            options={visibleSections.map((item) => ({
              label: `${item.title} · ${summary.sections[item.key].count}`,
              value: item.key,
            }))}
            onChange={(value) => {
              const next = new URLSearchParams(searchParams);
              next.set('section', String(value));
              setSearchParams(next, { replace: true });
            }}
          />

          <Block padding={18} variant={'outlined'}>
            <Flexbox gap={10}>
              <Flexbox horizontal align={'center'} gap={10}>
                <activeSection.icon size={20} strokeWidth={2.1} />
                <Text fontSize={18} weight={600}>
                  {activeSection.title}
                </Text>
                <Tag size={'small'} variant={'outlined'}>
                  {summary.sections[section].count}
                </Tag>
              </Flexbox>
              <Text type={'secondary'}>{activeSection.description}</Text>
            </Flexbox>
          </Block>
        </Flexbox>

        <Block padding={18} variant={'outlined'}>
          <Flexbox gap={12}>
            {section === 'inbox' && canCreate && (
              <Block padding={16} variant={'outlined'}>
                <Flexbox gap={12}>
                  <Flexbox gap={4}>
                    <Text fontSize={16} weight={600}>
                      {t('space.memory.actions.create', { ns: 'file' })}
                    </Text>
                    <Text type={'secondary'}>
                      {t('space.memory.composer.description', { ns: 'file' })}
                    </Text>
                  </Flexbox>

                  <Text size={'small'} type={'secondary'}>
                    {t('space.memory.composer.titleLabel', { ns: 'file' })}
                  </Text>
                  <Input
                    aria-label={t('space.memory.composer.titleLabel', { ns: 'file' })}
                    maxLength={255}
                    name={'space-memory-candidate-title'}
                    placeholder={t('space.memory.composer.titlePlaceholder', { ns: 'file' })}
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                  />

                  <Text size={'small'} type={'secondary'}>
                    {t('space.memory.composer.summaryLabel', { ns: 'file' })}
                  </Text>
                  <Input.TextArea
                    aria-label={t('space.memory.composer.summaryLabel', { ns: 'file' })}
                    autoSize={{ maxRows: 5, minRows: 3 }}
                    maxLength={1000}
                    name={'space-memory-candidate-summary'}
                    placeholder={t('space.memory.composer.summaryPlaceholder', { ns: 'file' })}
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                  />

                  <Flexbox gap={8}>
                    <Text size={'small'} type={'secondary'}>
                      {t('space.memory.composer.categoryLabel', { ns: 'file' })}
                    </Text>
                    <Segmented
                      block
                      value={draftCategory}
                      options={spaceMemoryCategories.map((category) => ({
                        label: t(`space.memory.categories.${category}`, { ns: 'file' }),
                        value: category,
                      }))}
                      onChange={(value) => setDraftCategory(value as SpaceMemoryCategory)}
                    />
                  </Flexbox>

                  <Flexbox horizontal justify={'flex-end'}>
                    <Button loading={creating} type={'primary'} onClick={handleCreateCandidate}>
                      {t('space.memory.actions.create', { ns: 'file' })}
                    </Button>
                  </Flexbox>
                </Flexbox>
              </Block>
            )}

            <Flexbox horizontal align={'center'} gap={10} justify={'space-between'}>
              <Text fontSize={18} weight={600}>
                {t('space.memory.entries.title', { ns: 'file', section: activeSection.title })}
              </Text>
              <Tag size={'small'} variant={'outlined'}>
                {entryList.length}
              </Tag>
            </Flexbox>

            {entryList.length === 0 ? (
              <Text type={'secondary'}>
                {t(`space.memory.sections.${section}.empty`, { ns: 'file' })}
              </Text>
            ) : (
              <div className={styles.memoryEntryList}>
                {entryList.map((entry) => (
                  <div className={styles.memoryEntry} key={entry.id}>
                    <Flexbox gap={10}>
                      <Flexbox horizontal align={'center'} gap={8} justify={'space-between'}>
                        <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                          <Text fontSize={16} weight={600}>
                            {entry.title}
                          </Text>
                          <Tag size={'small'} variant={'outlined'}>
                            {t(`space.memory.categories.${entry.category}`, { ns: 'file' })}
                          </Tag>
                          <Tag size={'small'} variant={'outlined'}>
                            {entry.kind === 'candidate'
                              ? t('space.memory.entries.candidate', { ns: 'file' })
                              : t('space.memory.entries.memory', { ns: 'file' })}
                          </Tag>
                        </Flexbox>

                        {section === 'inbox' && canReview && (
                          <Button
                            loading={publishingId === entry.id}
                            size={'small'}
                            type={'primary'}
                            onClick={() => handlePublish(entry.id)}
                          >
                            {t('space.memory.actions.publish', { ns: 'file' })}
                          </Button>
                        )}
                      </Flexbox>

                      <Flexbox horizontal align={'center'} gap={8} wrap={'wrap'}>
                        {entry.summary && (
                          <Text size={'small'} type={'secondary'}>
                            {entry.summary}
                          </Text>
                        )}
                        {entry.sourceRefs.length > 0 && (
                          <div className={styles.sourceRefList}>
                            {entry.sourceRefs.map((source) => (
                              <Tag
                                key={`${entry.id}-${source.kind}-${source.id}`}
                                size={'small'}
                                variant={'filled'}
                              >
                                {renderSourceLabel(source)}
                              </Tag>
                            ))}
                          </div>
                        )}
                        <Text size={'small'} type={'secondary'}>
                          {t('space.memory.entries.sources', {
                            count: entry.sourceCount,
                            ns: 'file',
                          })}
                        </Text>
                        <Text size={'small'} type={'secondary'}>
                          {renderTimelineLabel(entry)}
                        </Text>
                        {renderActorLabel(entry) && (
                          <Text size={'small'} type={'secondary'}>
                            {renderActorLabel(entry)}
                          </Text>
                        )}
                      </Flexbox>
                    </Flexbox>
                  </div>
                ))}
              </div>
            )}
          </Flexbox>
        </Block>

        <Button onClick={() => navigate(buildSpaceRootPath(summary.id))}>
          {t('space.settings.back', { ns: 'file' })}
        </Button>
      </Flexbox>
    </Flexbox>
  );
});

SpaceMemoryPage.displayName = 'SpaceMemoryPage';

export default SpaceMemoryPage;
