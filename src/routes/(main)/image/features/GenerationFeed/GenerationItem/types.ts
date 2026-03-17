import { type Generation, type GenerationBatch } from '@/types/generation';

export interface GenerationItemProps {
  generation: Generation;
  generationBatch: GenerationBatch;
  prompt: string;
}

export interface ActionButtonsProps {
  onCopySeed?: () => void;
  onDelete: () => void;
  onDownload?: () => void;
  seedTooltip?: string;
  showCopySeed?: boolean;
  showDownload?: boolean;
}

export interface SuccessStateProps {
  aspectRatio: string;
  generation: Generation;
  generationBatch: GenerationBatch;
  onImageLoadFailed: (url?: string) => void;
  onCopySeed?: () => void;
  onDelete: () => void;
  onDownload: () => void;
  prompt: string;
  seedTooltip?: string;
}

export interface ErrorStateProps {
  aspectRatio: string;
  actionTitle?: string;
  errorMessage?: string;
  generation: Generation;
  generationBatch: GenerationBatch;
  onAction?: () => void;
  onCopyError: () => void;
  onDelete: () => void;
}

export interface LoadingStateProps {
  aspectRatio: string;
  generation: Generation;
  generationBatch: GenerationBatch;
  onDelete: () => void;
}
