'use client';

import { App } from 'antd';
import { Flexbox, Icon, Tabs } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import isEqual from 'fast-deep-equal';
import {
  AudioLines,
  BoltIcon,
  Grid3x3Icon,
  ImageIcon,
  MessageSquareTextIcon,
  MicIcon,
  VideoIcon,
} from 'lucide-react';
import { memo, Suspense, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useIsMobile } from '@/hooks/useIsMobile';
import { aiModelSelectors, useAiInfraStore } from '@/store/aiInfra';

import DisabledModels from './DisabledModels';
import EmptyModels from './EmptyModels';
import EnabledModelList from './EnabledModelList';
import ModelTitle from './ModelTitle';
import { type ProviderSettingsContextValue } from './ProviderSettingsContext';
import { ProviderSettingsContext } from './ProviderSettingsContext';
import SearchResult from './SearchResult';
import SkeletonList from './SkeletonList';

interface ContentProps {
  fetchRemoteModelsLoading?: boolean;
  id: string;
  onFetchRemoteModels?: () => Promise<void>;
  showAddNewModel?: boolean;
  showModelFetcher?: boolean;
}

const Content = memo<ContentProps>(
  ({
    fetchRemoteModelsLoading = false,
    id,
    onFetchRemoteModels,
    showAddNewModel = true,
    showModelFetcher = true,
  }) => {
    // preload common namespace to avoid Suspense remount when child components start using it (e.g. infinite scroll loading text)
    const { t } = useTranslation(['modelProvider', 'common']);
    const [activeTab, setActiveTab] = useState('all');

    const [isSearching, isEmpty, useFetchAiProviderModels] = useAiInfraStore((s) => [
      !!s.modelSearchKeyword,
      aiModelSelectors.isEmptyAiProviderModelList(s),
      s.useFetchAiProviderModels,
    ]);

    const allModels = useAiInfraStore(aiModelSelectors.filteredAiProviderModelList, isEqual);

    const { isLoading } = useFetchAiProviderModels(id);

    // Count models by type (for all models, not just enabled)
    const modelCounts = useMemo(() => {
      const counts = {
        all: allModels.length,
        chat: 0,
        embedding: 0,
        image: 0,
        stt: 0,
        tts: 0,
        video: 0,
      };

      allModels.forEach((model) => {
        const type = model.type;
        if (type && Object.prototype.hasOwnProperty.call(counts, type)) {
          counts[type as keyof typeof counts]++;
        }
      });

      return counts;
    }, [allModels]);

    // Tab definitions with counts (only show tabs with models > 0, except 'all' tab)
    const tabs = useMemo(() => {
      const formatTabLabel = (baseLabel: string, count: number) =>
        count > 0 ? `${baseLabel} (${count})` : baseLabel;

      const allTabs = [
        {
          count: modelCounts.all,
          icon: <Icon icon={Grid3x3Icon} size={16} />,
          key: 'all',
          label: formatTabLabel(t('providerModels.tabs.all'), modelCounts.all),
        },
        {
          count: modelCounts.chat,
          icon: <Icon icon={MessageSquareTextIcon} size={16} />,
          key: 'chat',
          label: formatTabLabel(t('providerModels.tabs.chat'), modelCounts.chat),
        },
        {
          count: modelCounts.image,
          icon: <Icon icon={ImageIcon} size={16} />,
          key: 'image',
          label: formatTabLabel(t('providerModels.tabs.image'), modelCounts.image),
        },
        {
          count: modelCounts.video,
          icon: <Icon icon={VideoIcon} size={16} />,
          key: 'video',
          label: formatTabLabel(t('providerModels.tabs.video'), modelCounts.video),
        },
        {
          count: modelCounts.embedding,
          icon: <Icon icon={BoltIcon} size={16} />,
          key: 'embedding',
          label: formatTabLabel(t('providerModels.tabs.embedding'), modelCounts.embedding),
        },
        {
          count: modelCounts.stt,
          icon: <Icon icon={MicIcon} size={16} />,
          key: 'stt',
          label: formatTabLabel(t('providerModels.tabs.stt'), modelCounts.stt),
        },
        {
          count: modelCounts.tts,
          icon: <Icon icon={AudioLines} size={16} />,
          key: 'tts',
          label: formatTabLabel(t('providerModels.tabs.tts'), modelCounts.tts),
        },
      ];

      // Only show tabs that have models (count > 0), but always show 'all' tab
      return allTabs.filter((tab) => tab.key === 'all' || tab.count > 0);
    }, [modelCounts]);

    // Ensure active tab is available, fallback to 'all' if current tab is hidden
    const availableTabKeys = tabs.map((tab) => tab.key);
    const currentActiveTab = availableTabKeys.includes(activeTab) ? activeTab : 'all';

    if (isLoading) return <SkeletonList />;

    if (isSearching) return <SearchResult />;

    return isEmpty ? (
      <EmptyModels
        fetchRemoteModelsLoading={fetchRemoteModelsLoading}
        showAddNewModel={showAddNewModel}
        showModelFetcher={showModelFetcher}
        onFetchRemoteModels={onFetchRemoteModels}
      />
    ) : (
      <Flexbox>
        <Tabs
          activeKey={currentActiveTab}
          items={tabs}
          size="small"
          style={{ marginBottom: 12, marginLeft: -6 }}
          onChange={setActiveTab}
        />
        <EnabledModelList activeTab={currentActiveTab} />
        <DisabledModels activeTab={currentActiveTab} providerId={id} />
      </Flexbox>
    );
  },
);

interface ModelListProps extends ProviderSettingsContextValue {
  id: string;
}

const ModelList = memo<ModelListProps>(
  ({ id, showModelFetcher, sdkType, showAddNewModel, showDeployName, modelEditable = true }) => {
    const { message } = App.useApp();
    const { t } = useTranslation('modelProvider');
    const mobile = useIsMobile();
    const [fetchRemoteModelList] = useAiInfraStore((s) => [s.fetchRemoteModelList]);
    const [fetchRemoteModelsLoading, setFetchRemoteModelsLoading] = useState(false);
    const autoFetchedProvidersRef = useRef(new Set<string>());
    const fetchInFlightRef = useRef(false);

    const handleFetchRemoteModels = useEffectEvent(async () => {
      if (fetchInFlightRef.current) return;

      fetchInFlightRef.current = true;
      setFetchRemoteModelsLoading(true);

      try {
        await fetchRemoteModelList(id);
      } catch (error) {
        console.error('Failed to fetch remote models:', error);
        message.error(t('providerModels.list.fetcher.fetchError'));
      } finally {
        fetchInFlightRef.current = false;
        setFetchRemoteModelsLoading(false);
      }
    });

    useEffect(() => {
      if (!showModelFetcher) return;
      if (autoFetchedProvidersRef.current.has(id)) return;

      autoFetchedProvidersRef.current.add(id);
      void handleFetchRemoteModels();
    }, [handleFetchRemoteModels, id, showModelFetcher]);

    return (
      <ProviderSettingsContext
        value={{ modelEditable, sdkType, showAddNewModel, showDeployName, showModelFetcher }}
      >
        <Flexbox
          gap={16}
          paddingInline={mobile ? 12 : 0}
          style={{
            background: mobile ? cssVar.colorBgContainer : undefined,
            paddingBottom: 16,
            paddingTop: 8,
          }}
        >
          <ModelTitle
            fetchRemoteModelsLoading={fetchRemoteModelsLoading}
            provider={id}
            showAddNewModel={showAddNewModel}
            showModelFetcher={showModelFetcher}
            onFetchRemoteModels={handleFetchRemoteModels}
          />
          <Suspense fallback={<SkeletonList />}>
            <Content
              fetchRemoteModelsLoading={fetchRemoteModelsLoading}
              id={id}
              showAddNewModel={showAddNewModel}
              showModelFetcher={showModelFetcher}
              onFetchRemoteModels={handleFetchRemoteModels}
            />
          </Suspense>
        </Flexbox>
      </ProviderSettingsContext>
    );
  },
);

export default ModelList;
