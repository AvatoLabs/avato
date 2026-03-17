'use client';

import { Block } from '@lobehub/ui';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import ImageItem from '@/components/ImageItem';

import { ActionButtons } from './ActionButtons';
import { styles } from './styles';
import { type SuccessStateProps } from './types';
import { getThumbnailMaxWidth } from './utils';

// Success state component
export const SuccessState = memo<SuccessStateProps>(
  ({
    generation,
    generationBatch,
    prompt,
    aspectRatio,
    onImageLoadFailed,
    onDelete,
    onDownload,
    onCopySeed,
    seedTooltip,
  }) => {
    const assetUrl = generation.asset?.url;
    const assetThumbnailUrl = generation.asset?.thumbnailUrl;
    const assetOriginalUrl = generation.asset?.originalUrl;

    const candidateUrls = useMemo(() => {
      const urls = [
        generation.fileId ? `/f/${generation.fileId}` : undefined,
        assetUrl,
        assetThumbnailUrl,
        assetOriginalUrl?.startsWith('http://') || assetOriginalUrl?.startsWith('https://')
          ? assetOriginalUrl
          : undefined,
      ].filter(Boolean) as string[];

      return [...new Set(urls)];
    }, [assetOriginalUrl, assetThumbnailUrl, assetUrl, generation.fileId]);

    const [activeUrlIndex, setActiveUrlIndex] = useState(0);

    useEffect(() => {
      setActiveUrlIndex(0);
    }, [candidateUrls]);

    const activeUrl = candidateUrls[activeUrlIndex];

    const handleImageError = useCallback(() => {
      const nextIndex = activeUrlIndex + 1;
      if (nextIndex < candidateUrls.length) {
        setActiveUrlIndex(nextIndex);
        return;
      }

      onImageLoadFailed(activeUrl);
    }, [activeUrl, activeUrlIndex, candidateUrls.length, onImageLoadFailed]);

    return (
      <Block
        align={'center'}
        className={styles.imageContainer}
        justify={'center'}
        variant={'filled'}
        style={{
          aspectRatio,
          maxWidth: getThumbnailMaxWidth(generation, generationBatch),
        }}
      >
        <ImageItem
          alt={prompt}
          style={{ height: '100%', width: '100%' }}
          url={activeUrl}
          preview={{
            src: activeUrl,
          }}
          onError={handleImageError}
        />
        <ActionButtons
          showDownload
          seedTooltip={seedTooltip}
          showCopySeed={!!generation.seed}
          onCopySeed={onCopySeed}
          onDelete={onDelete}
          onDownload={onDownload}
        />
      </Block>
    );
  },
);

SuccessState.displayName = 'SuccessState';
