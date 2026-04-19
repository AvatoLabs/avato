import * as FileSystem from 'expo-file-system/legacy';
import { Image as ExpoImage } from 'expo-image';
import { Folder } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import { Image as RNImage } from 'react-native';

import { isImage } from '../../lib/resourceFile';
import { buildRemoteFileCandidates, buildRemoteSource } from '../../lib/resourcePreview';
import { useThemeColors } from '../../theme/colors';
import { tokens } from '../../theme/tokens';
import type { FileListItem } from '../../types';
import ResourceFileTypeIcon from './ResourceFileTypeIcon';

const isFolder = (item: FileListItem) => item.fileType === 'custom/folder';

interface ResourceThumbnailProps {
  apiBaseUrl: string;
  cachedLocalUri?: string | null;
  isVisible?: boolean;
  item: FileListItem;
  onInvalidateCache?: (fileId: string) => void;
  remoteHeaders?: Record<string, string>;
  roundedClassName?: string;
  size?: number;
}

export default function ResourceThumbnail({
  apiBaseUrl,
  cachedLocalUri,
  isVisible = true,
  item,
  onInvalidateCache,
  remoteHeaders,
  roundedClassName = 'rounded-xl',
  size = 48,
}: ResourceThumbnailProps) {
  const colors = useThemeColors();
  const itemIsFolder = isFolder(item);
  const isImageFile = !itemIsFolder && isImage(item.fileType, item.name);
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [cachedUriFailed, setCachedUriFailed] = useState(false);
  const thumbnailCandidates = isImageFile ? buildRemoteFileCandidates(apiBaseUrl, item) : [];
  const thumbnailUrl = thumbnailCandidates[thumbnailIndex] || null;

  useEffect(() => {
    setThumbnailIndex(0);
    setCachedUriFailed(false);
  }, [apiBaseUrl, cachedLocalUri, item.id, item.url]);

  useEffect(() => {
    if (!cachedLocalUri) return;

    let cancelled = false;

    const validateCachedThumbnail = async () => {
      try {
        const info = await FileSystem.getInfoAsync(cachedLocalUri);
        if (!info.exists) {
          if (!cancelled) {
            setCachedUriFailed(true);
            onInvalidateCache?.(item.id);
          }
          return;
        }

        if (!cancelled) setCachedUriFailed(false);
      } catch {
        if (!cancelled) {
          setCachedUriFailed(true);
          onInvalidateCache?.(item.id);
        }
      }
    };

    void validateCachedThumbnail();

    return () => {
      cancelled = true;
    };
  }, [cachedLocalUri, item.id, onInvalidateCache]);

  const handleRemoteThumbnailError = useCallback(() => {
    if (thumbnailIndex < thumbnailCandidates.length - 1) {
      setThumbnailIndex((current) => current + 1);
    }
  }, [thumbnailCandidates.length, thumbnailIndex]);

  const usingCachedLocalThumbnail = Boolean(cachedLocalUri && !cachedUriFailed);
  const shouldUseRemoteThumbnail = Boolean(!usingCachedLocalThumbnail && isVisible && thumbnailUrl);
  const remoteThumbnailSource = shouldUseRemoteThumbnail
    ? buildRemoteSource(apiBaseUrl, thumbnailUrl, remoteHeaders)
    : null;

  const handleImageError = useCallback(() => {
    if (usingCachedLocalThumbnail) {
      setCachedUriFailed(true);
      return;
    }

    if (shouldUseRemoteThumbnail) {
      handleRemoteThumbnailError();
    }
  }, [handleRemoteThumbnailError, shouldUseRemoteThumbnail, usingCachedLocalThumbnail]);

  if (itemIsFolder) {
    return (
      <Folder
        color={colors.secondaryText}
        size={size * 0.54}
        strokeWidth={tokens.icon.strokeWidth}
      />
    );
  }

  if (remoteThumbnailSource) {
    return (
      <ExpoImage
        cachePolicy="memory-disk"
        className={`h-full w-full ${roundedClassName}`}
        contentFit="cover"
        key={`remote:${item.id}:${thumbnailIndex}`}
        source={remoteThumbnailSource}
        transition={100}
        onError={handleImageError}
      />
    );
  }

  if (usingCachedLocalThumbnail) {
    return (
      <RNImage
        className={`h-full w-full ${roundedClassName}`}
        key={`local:${item.id}:${cachedLocalUri}`}
        resizeMode="cover"
        source={{ uri: cachedLocalUri! }}
        onError={handleImageError}
      />
    );
  }

  return (
    <ResourceFileTypeIcon
      color={colors.secondaryText}
      fileName={item.name}
      fileType={item.fileType}
      size={size * 0.54}
    />
  );
}
