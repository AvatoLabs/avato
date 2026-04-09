'use client';

import { App } from 'antd';
import dayjs from 'dayjs';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDownloadImage } from '@/hooks/useDownloadImage';
import { useImageStore } from '@/store/image';
import { imageGenerationConfigSelectors } from '@/store/image/selectors';
import { AsyncTaskStatus } from '@/types/asyncTask';
import { inferFileExtensionFromImageUrl } from '@/utils/url';

import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';
import { SuccessState } from './SuccessState';
import { type GenerationItemProps } from './types';
import { getAspectRatio } from './utils';
import { resolveClientMediaUrl } from '../../../../../../utils/client/resolveClientMediaUrl';

const isSupportedParamSelector = imageGenerationConfigSelectors.isSupportedParam;

export const GenerationItem = memo<GenerationItemProps>(
  ({ generationBatch, generation, prompt }) => {
    const { message } = App.useApp();
    const { t } = useTranslation('image');
    const useCheckGenerationStatus = useImageStore((s) => s.useCheckGenerationStatus);
    const deleteGeneration = useImageStore((s) => s.removeGeneration);
    const refreshGenerationBatches = useImageStore((s) => s.refreshGenerationBatches);
    const reuseSeed = useImageStore((s) => s.reuseSeed);
    const activeTopicId = useImageStore((s) => s.activeGenerationTopicId);
    const isSupportSeed = useImageStore(isSupportedParamSelector('seed'));
    const { downloadImage } = useDownloadImage();
    const hasRetriedBrokenImageRef = useRef(false);
    const [assetLoadFailed, setAssetLoadFailed] = useState(false);

    const isFinalized =
      generation.task.status === AsyncTaskStatus.Success ||
      generation.task.status === AsyncTaskStatus.Error;

    const shouldPoll = !isFinalized;
    useCheckGenerationStatus(generation.id, generation.task.id, activeTopicId!, shouldPoll);

    const aspectRatio = getAspectRatio(generation, generationBatch);
    const hasRenderableAsset =
      !!generation.fileId ||
      !!generation.asset?.url ||
      !!generation.asset?.thumbnailUrl ||
      !!generation.asset?.originalUrl?.match(/^https?:\/\//);

    useEffect(() => {
      hasRetriedBrokenImageRef.current = false;
      setAssetLoadFailed(false);
    }, [
      generation.asset?.originalUrl,
      generation.asset?.thumbnailUrl,
      generation.asset?.url,
      generation.fileId,
      generation.id,
    ]);

    // Event handler functions
    const handleDeleteGeneration = useCallback(async () => {
      try {
        await deleteGeneration(generation.id);
      } catch (error) {
        console.error('Failed to delete generation:', error);
        message.error(t('generation.actions.deleteFailed'));
      }
    }, [deleteGeneration, generation.id, message, t]);

    const handleDownloadImage = useCallback(async () => {
      const rawUrl = generation.fileId ? `/f/${generation.fileId}` : generation.asset?.url;
      const downloadUrl = rawUrl ? resolveClientMediaUrl(rawUrl) : '';
      if (!downloadUrl || !generation.asset?.url) return;

      // Generate filename with prompt and timestamp
      const timestamp = dayjs(generation.createdAt).format('YYYY-MM-DD_HH-mm-ss');
      const baseName = prompt.slice(0, 30).trim();
      const sanitizedBaseName = baseName.replaceAll(/["%*/:<>?\\|]/g, '').replaceAll(/\s+/g, '_');
      const safePrompt = sanitizedBaseName || 'Untitled';

      const fileExtension = inferFileExtensionFromImageUrl(generation.asset.url);
      const fileName = `${safePrompt}_${timestamp}.${fileExtension}`;

      try {
        await downloadImage(downloadUrl, fileName);
      } catch (error) {
        console.error('Failed to download image:', error);
        message.error(t('generation.actions.downloadFailed'));
      }
    }, [downloadImage, generation.asset?.url, generation.createdAt, generation.fileId, message, prompt, t]);

    const handleCopySeed = useCallback(async () => {
      if (!generation.seed) return;

      // If current model supports seed parameter, apply it directly to configuration
      if (isSupportSeed) {
        try {
          reuseSeed(generation.seed);
          message.success(t('generation.actions.seedApplied'));
        } catch (error) {
          console.error('Failed to apply seed:', error);
          message.error(t('generation.actions.seedApplyFailed'));
        }
      } else {
        // If current model doesn't support seed parameter, copy to clipboard
        try {
          await navigator.clipboard.writeText(generation.seed.toString());
          message.success(t('generation.actions.seedCopied'));
        } catch (error) {
          console.error('Failed to copy seed:', error);
          message.error(t('generation.actions.seedCopyFailed'));
        }
      }
    }, [generation.seed, isSupportSeed, message, t, reuseSeed]);

    const handleCopyError = useCallback(async () => {
      if (!generation.task.error) return;

      const errorMessage =
        typeof generation.task.error.body === 'string'
          ? generation.task.error.body
          : generation.task.error.body?.detail || generation.task.error.name || 'Unknown error';

      try {
        await navigator.clipboard.writeText(errorMessage);
        message.success(t('generation.actions.errorCopied'));
      } catch (error) {
        console.error('Failed to copy error message:', error);
        message.error(t('generation.actions.errorCopyFailed'));
      }
    }, [generation.task.error, message, t]);

    const handleImageLoadFailed = useCallback(async () => {
      if (!hasRetriedBrokenImageRef.current) {
        hasRetriedBrokenImageRef.current = true;

        try {
          await refreshGenerationBatches();
          return;
        } catch (error) {
          console.error('Failed to refresh generation batch after image load error:', error);
        }
      }

      setAssetLoadFailed(true);
      message.error(t('generation.status.imageUnavailable'));
    }, [message, refreshGenerationBatches, t]);

    const handleRetryBrokenImage = useCallback(async () => {
      setAssetLoadFailed(false);
      hasRetriedBrokenImageRef.current = true;

      try {
        await refreshGenerationBatches();
      } catch (error) {
        console.error('Failed to retry image loading:', error);
        setAssetLoadFailed(true);
        message.error(t('generation.status.imageUnavailable'));
      }
    }, [message, refreshGenerationBatches, t]);

    // Render corresponding component based on status
    if (generation.task.status === AsyncTaskStatus.Success && hasRenderableAsset) {
      if (assetLoadFailed) {
        return (
          <ErrorState
            actionTitle={t('generation.actions.retryLoad')}
            aspectRatio={aspectRatio}
            errorMessage={t('generation.status.imageUnavailable')}
            generation={generation}
            generationBatch={generationBatch}
            onAction={handleRetryBrokenImage}
            onCopyError={handleCopyError}
            onDelete={handleDeleteGeneration}
          />
        );
      }

      const seedTooltip = isSupportSeed
        ? t('generation.actions.applySeed')
        : t('generation.actions.copySeed');

      return (
        <SuccessState
          aspectRatio={aspectRatio}
          generation={generation}
          generationBatch={generationBatch}
          prompt={prompt}
          seedTooltip={seedTooltip}
          onCopySeed={handleCopySeed}
          onDelete={handleDeleteGeneration}
          onDownload={handleDownloadImage}
          onImageLoadFailed={handleImageLoadFailed}
        />
      );
    }

    if (generation.task.status === AsyncTaskStatus.Error) {
      return (
        <ErrorState
          aspectRatio={aspectRatio}
          generation={generation}
          generationBatch={generationBatch}
          onCopyError={handleCopyError}
          onDelete={handleDeleteGeneration}
        />
      );
    }

    // Loading state (Processing or Pending)
    return (
      <LoadingState
        aspectRatio={aspectRatio}
        generation={generation}
        generationBatch={generationBatch}
        onDelete={handleDeleteGeneration}
      />
    );
  },
);

GenerationItem.displayName = 'GenerationItem';
