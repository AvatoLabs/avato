export type ComputerUseButton = 'left' | 'middle' | 'right';
export type ComputerUseImageFormat = 'jpeg' | 'png';
export type ComputerUseScreenshotSource = 'main-window' | 'screen';

export interface ComputerUsePoint {
  x: number;
  y: number;
}

export interface ComputerUseBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ComputerUseDisplayInfo {
  bounds: ComputerUseBounds;
  id: number;
  label?: string;
  scaleFactor: number;
  size: {
    height: number;
    width: number;
  };
  workArea: ComputerUseBounds;
}

export interface ComputerUseScreenshotInput {
  displayId?: number | string;
  format?: ComputerUseImageFormat;
  maxHeight?: number;
  maxWidth?: number;
  quality?: number;
  source?: ComputerUseScreenshotSource;
}

export interface ComputerUseScreenshotResult {
  base64?: string;
  displayId?: string;
  error?: string;
  height?: number;
  mediaType?: 'image/jpeg' | 'image/png';
  scaleFactor?: number;
  source: ComputerUseScreenshotSource;
  success: boolean;
  width?: number;
}

export interface ComputerUseMouseInput extends ComputerUsePoint {
  button?: ComputerUseButton;
}

export interface ComputerUseDragInput {
  button?: ComputerUseButton;
  from: ComputerUsePoint;
  steps?: number;
  to: ComputerUsePoint;
}

export interface ComputerUseScrollInput extends ComputerUsePoint {
  deltaX?: number;
  deltaY?: number;
}

export interface ComputerUseTypeInput {
  text: string;
}

export type ComputerUseKeyModifier =
  | 'alt'
  | 'cmd'
  | 'command'
  | 'control'
  | 'ctrl'
  | 'meta'
  | 'shift';

export interface ComputerUseKeyInput {
  key: string;
  modifiers?: ComputerUseKeyModifier[];
}

export interface ComputerUseActionResult {
  error?: string;
  success: boolean;
}

export type ComputerUseToolApiName =
  | 'click'
  | 'doubleClick'
  | 'drag'
  | 'getDisplays'
  | 'pressKey'
  | 'screenshot'
  | 'scroll'
  | 'typeText';
