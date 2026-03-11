/**
 * Ambient module declarations for Expo packages without bundled types.
 */
declare module 'expo-clipboard' {
  export function setStringAsync(text: string): Promise<boolean>;
  export function getStringAsync(): Promise<string>;
  export function hasStringAsync(): Promise<boolean>;
}

declare module 'expo-haptics' {
  export enum ImpactFeedbackStyle {
    Heavy = 'heavy',
    Light = 'light',
    Medium = 'medium',
  }

  export enum NotificationFeedbackType {
    Error = 'error',
    Success = 'success',
    Warning = 'warning',
  }

  export function impactAsync(style?: ImpactFeedbackStyle): Promise<void>;
  export function notificationAsync(type?: NotificationFeedbackType): Promise<void>;
  export function selectionAsync(): Promise<void>;
}

declare module 'expo-image-picker' {
  export type MediaType = 'images' | 'videos' | 'all';

  export interface ImagePickerAsset {
    fileName?: string;
    fileSize?: number;
    height: number;
    mimeType?: string;
    type?: string;
    uri: string;
    width: number;
  }

  export interface ImagePickerResult {
    assets: ImagePickerAsset[];
    canceled: boolean;
  }

  export interface ImagePickerOptions {
    allowsEditing?: boolean;
    allowsMultipleSelection?: boolean;
    mediaTypes?: MediaType;
    quality?: number;
  }

  export function launchCameraAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
  export function launchImageLibraryAsync(options?: ImagePickerOptions): Promise<ImagePickerResult>;
  export function requestCameraPermissionsAsync(): Promise<{ status: string }>;
  export function requestMediaLibraryPermissionsAsync(): Promise<{ status: string }>;
}

declare module 'expo-document-picker' {
  export interface DocumentPickerAsset {
    mimeType?: string;
    name: string;
    size?: number;
    uri: string;
  }

  export interface DocumentPickerResult {
    assets: DocumentPickerAsset[];
    canceled: boolean;
  }

  export interface DocumentPickerOptions {
    copyToCacheDirectory?: boolean;
    multiple?: boolean;
    type?: string | string[];
  }

  export function getDocumentAsync(options?: DocumentPickerOptions): Promise<DocumentPickerResult>;
}
