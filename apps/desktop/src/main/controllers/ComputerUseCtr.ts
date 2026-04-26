import type {
  ComputerUseActionResult,
  ComputerUseButton,
  ComputerUseDisplayInfo,
  ComputerUseDragInput,
  ComputerUseKeyInput,
  ComputerUseKeyModifier,
  ComputerUseMouseInput,
  ComputerUseScreenshotInput,
  ComputerUseScreenshotResult,
  ComputerUseScrollInput,
  ComputerUseToolApiName,
  ComputerUseTypeInput,
} from '@lobechat/electron-client-ipc';
import { type BrowserWindow, desktopCapturer, type NativeImage, screen } from 'electron';

import { createLogger } from '@/utils/logger';

import { ControllerModule, IpcMethod } from './index';

const logger = createLogger('controllers:ComputerUseCtr');

const DEFAULT_MAX_WIDTH = 1280;
const DEFAULT_MAX_HEIGHT = 900;
const DEFAULT_JPEG_QUALITY = 70;
const MAX_DRAG_STEPS = 60;
const MAX_KEY_CODE_LENGTH = 64;
const MAX_SCROLL_DELTA = 2000;
const MAX_SCREENSHOT_HEIGHT = 1080;
const MAX_SCREENSHOT_WIDTH = 1920;
const MAX_TYPE_TEXT_LENGTH = 4000;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const normalizeButton = (button: unknown): ComputerUseButton => {
  if (button === 'right' || button === 'middle') return button;
  return 'left';
};

const readFiniteNumber = (
  data: Record<string, unknown>,
  key: string,
  fallback?: number,
): number => {
  const value = data[key];
  if (value === undefined) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing numeric field: ${key}`);
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid numeric field: ${key}`);
  }

  return value;
};

const readPoint = (data: Record<string, unknown>): { x: number; y: number } => {
  return {
    x: readFiniteNumber(data, 'x'),
    y: readFiniteNumber(data, 'y'),
  };
};

const readBoundedPoint = (
  data: Record<string, unknown>,
  bounds: Pick<Electron.Rectangle, 'height' | 'width'>,
): { x: number; y: number } => {
  const point = readPoint(data);
  const x = Math.round(point.x);
  const y = Math.round(point.y);

  if (x < 0 || y < 0 || x >= bounds.width || y >= bounds.height) {
    throw new Error(`Point is outside the main window bounds: ${x}, ${y}`);
  }

  return { x, y };
};

const serializeBounds = (bounds: Electron.Rectangle) => ({
  height: bounds.height,
  width: bounds.width,
  x: bounds.x,
  y: bounds.y,
});

const fitSize = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);

  return {
    height: Math.max(1, Math.round(height * ratio)),
    width: Math.max(1, Math.round(width * ratio)),
  };
};

const encodeImage = (
  image: NativeImage,
  input: ComputerUseScreenshotInput,
): Pick<ComputerUseScreenshotResult, 'base64' | 'height' | 'mediaType' | 'width'> => {
  const size = image.getSize();
  const maxWidth = clamp(Math.round(input.maxWidth ?? DEFAULT_MAX_WIDTH), 1, MAX_SCREENSHOT_WIDTH);
  const maxHeight = clamp(
    Math.round(input.maxHeight ?? DEFAULT_MAX_HEIGHT),
    1,
    MAX_SCREENSHOT_HEIGHT,
  );
  const fittedSize = fitSize(size.width, size.height, maxWidth, maxHeight);
  const outputImage =
    fittedSize.width === size.width && fittedSize.height === size.height
      ? image
      : image.resize(fittedSize);

  const outputSize = outputImage.getSize();
  const format = input.format === 'png' ? 'png' : 'jpeg';
  const buffer =
    format === 'png'
      ? outputImage.toPNG()
      : outputImage.toJPEG(clamp(Math.round(input.quality ?? DEFAULT_JPEG_QUALITY), 1, 100));

  return {
    base64: buffer.toString('base64'),
    height: outputSize.height,
    mediaType: format === 'png' ? 'image/png' : 'image/jpeg',
    width: outputSize.width,
  };
};

export default class ComputerUseCtr extends ControllerModule {
  static override readonly groupName = 'computerUse';

  @IpcMethod()
  getDisplays(): ComputerUseDisplayInfo[] {
    return screen.getAllDisplays().map((display) => ({
      bounds: serializeBounds(display.bounds),
      id: display.id,
      label: display.label,
      scaleFactor: display.scaleFactor,
      size: {
        height: display.size.height,
        width: display.size.width,
      },
      workArea: serializeBounds(display.workArea),
    }));
  }

  @IpcMethod()
  async screenshot(input: ComputerUseScreenshotInput = {}): Promise<ComputerUseScreenshotResult> {
    const source = input.source === 'screen' ? 'screen' : 'main-window';

    try {
      if (source === 'screen') {
        return await this.captureScreen(input);
      }

      return await this.captureMainWindow(input);
    } catch (error) {
      logger.warn('Computer use screenshot failed', error);
      return {
        error: error instanceof Error ? error.message : String(error),
        source,
        success: false,
      };
    }
  }

  @IpcMethod()
  async click(input: ComputerUseMouseInput): Promise<ComputerUseActionResult> {
    await this.sendMouseClick(input, 1);
    return { success: true };
  }

  @IpcMethod()
  async doubleClick(input: ComputerUseMouseInput): Promise<ComputerUseActionResult> {
    await this.sendMouseClick(input, 2);
    return { success: true };
  }

  @IpcMethod()
  async drag(input: ComputerUseDragInput): Promise<ComputerUseActionResult> {
    if (!isRecord(input?.from) || !isRecord(input?.to)) {
      throw new Error('Drag input must include from and to points');
    }

    const steps = clamp(Math.round(input.steps ?? 16), 1, MAX_DRAG_STEPS);
    const window = this.getFocusedMainWindow();
    const bounds = this.getInputBounds(window);
    const from = this.parseMouseInput(input.from, bounds, input.button);
    const to = this.parseMouseInput(input.to, bounds, input.button);

    window.webContents.sendInputEvent({
      button: from.button,
      clickCount: 1,
      type: 'mouseDown',
      x: from.x,
      y: from.y,
    });

    for (let index = 1; index <= steps; index += 1) {
      const ratio = index / steps;
      window.webContents.sendInputEvent({
        button: from.button,
        type: 'mouseMove',
        x: Math.round(from.x + (to.x - from.x) * ratio),
        y: Math.round(from.y + (to.y - from.y) * ratio),
      });
    }

    window.webContents.sendInputEvent({
      button: from.button,
      clickCount: 1,
      type: 'mouseUp',
      x: to.x,
      y: to.y,
    });

    return { success: true };
  }

  @IpcMethod()
  async scroll(input: ComputerUseScrollInput): Promise<ComputerUseActionResult> {
    const window = this.getFocusedMainWindow();
    const point = this.parseMouseInput(input, this.getInputBounds(window));
    const data = input as unknown as Record<string, unknown>;
    window.webContents.sendInputEvent({
      deltaX: clamp(readFiniteNumber(data, 'deltaX', 0), -MAX_SCROLL_DELTA, MAX_SCROLL_DELTA),
      deltaY: clamp(readFiniteNumber(data, 'deltaY', 0), -MAX_SCROLL_DELTA, MAX_SCROLL_DELTA),
      type: 'mouseWheel',
      x: point.x,
      y: point.y,
    });

    return { success: true };
  }

  @IpcMethod()
  async typeText(input: ComputerUseTypeInput): Promise<ComputerUseActionResult> {
    if (typeof input?.text !== 'string') {
      throw new Error('typeText input must include text');
    }
    if (input.text.length > MAX_TYPE_TEXT_LENGTH) {
      throw new Error(`typeText input exceeds ${MAX_TYPE_TEXT_LENGTH} characters`);
    }

    const window = this.getFocusedMainWindow();
    await window.webContents.insertText(input.text);

    return { success: true };
  }

  @IpcMethod()
  async pressKey(input: ComputerUseKeyInput): Promise<ComputerUseActionResult> {
    if (typeof input?.key !== 'string' || input.key.length === 0) {
      throw new Error('pressKey input must include key');
    }
    if (input.key.length > MAX_KEY_CODE_LENGTH) {
      throw new Error(`pressKey key exceeds ${MAX_KEY_CODE_LENGTH} characters`);
    }

    const modifiers = this.normalizeModifiers(input.modifiers);
    const window = this.getFocusedMainWindow();
    window.webContents.sendInputEvent({
      keyCode: input.key,
      modifiers,
      type: 'keyDown',
    });
    window.webContents.sendInputEvent({
      keyCode: input.key,
      modifiers,
      type: 'keyUp',
    });

    return { success: true };
  }

  async execute(apiName: string, args: Record<string, unknown>): Promise<unknown> {
    const handlers: Record<ComputerUseToolApiName, () => Promise<unknown> | unknown> = {
      click: () => this.click(args as unknown as ComputerUseMouseInput),
      doubleClick: () => this.doubleClick(args as unknown as ComputerUseMouseInput),
      drag: () => this.drag(args as unknown as ComputerUseDragInput),
      getDisplays: () => this.getDisplays(),
      pressKey: () => this.pressKey(args as unknown as ComputerUseKeyInput),
      screenshot: () => this.screenshot(args as ComputerUseScreenshotInput),
      scroll: () => this.scroll(args as unknown as ComputerUseScrollInput),
      typeText: () => this.typeText(args as unknown as ComputerUseTypeInput),
    };

    const handler = handlers[apiName as ComputerUseToolApiName];
    if (!handler) {
      throw new Error(`Unsupported Computer Use API: ${apiName}`);
    }

    return handler();
  }

  private async captureMainWindow(
    input: ComputerUseScreenshotInput,
  ): Promise<ComputerUseScreenshotResult> {
    const window = this.getMainWindow();
    const image = await window.capturePage();

    return {
      ...encodeImage(image, input),
      source: 'main-window',
      success: true,
    };
  }

  private async captureScreen(
    input: ComputerUseScreenshotInput,
  ): Promise<ComputerUseScreenshotResult> {
    const displays = screen.getAllDisplays();
    const selectedDisplay =
      displays.find((display) => String(display.id) === String(input.displayId)) ||
      screen.getPrimaryDisplay();

    const maxWidth = clamp(
      Math.round(input.maxWidth ?? DEFAULT_MAX_WIDTH),
      1,
      MAX_SCREENSHOT_WIDTH,
    );
    const maxHeight = clamp(
      Math.round(input.maxHeight ?? DEFAULT_MAX_HEIGHT),
      1,
      MAX_SCREENSHOT_HEIGHT,
    );
    const thumbnailSize = fitSize(
      selectedDisplay.size.width,
      selectedDisplay.size.height,
      maxWidth,
      maxHeight,
    );
    const sources = await desktopCapturer.getSources({
      fetchWindowIcons: false,
      thumbnailSize,
      types: ['screen'],
    });
    const source =
      sources.find((item) => item.display_id === String(selectedDisplay.id)) || sources[0];

    if (!source || source.thumbnail.isEmpty()) {
      throw new Error('Screen capture is unavailable or not authorized');
    }

    return {
      ...encodeImage(source.thumbnail, input),
      displayId: source.display_id,
      scaleFactor: selectedDisplay.scaleFactor,
      source: 'screen',
      success: true,
    };
  }

  private getMainWindow(): BrowserWindow {
    const window = this.app.browserManager.getMainWindow()?.browserWindow;
    if (!window || window.isDestroyed()) {
      throw new Error('MAIN_WINDOW_UNAVAILABLE');
    }

    return window;
  }

  private getFocusedMainWindow(): BrowserWindow {
    const window = this.getMainWindow();

    if (window.isMinimized()) window.restore();
    window.focus();
    window.webContents.focus();

    return window;
  }

  private parseMouseInput(
    input: unknown,
    bounds: Pick<Electron.Rectangle, 'height' | 'width'>,
    fallbackButton?: ComputerUseButton,
  ): ComputerUseMouseInput {
    if (!isRecord(input)) {
      throw new Error('Mouse input must be an object');
    }

    return {
      ...readBoundedPoint(input, bounds),
      button: normalizeButton(input.button ?? fallbackButton),
    };
  }

  private async sendMouseClick(input: unknown, clickCount: 1 | 2) {
    const window = this.getFocusedMainWindow();
    const parsedInput = this.parseMouseInput(input, this.getInputBounds(window));
    const button = normalizeButton(parsedInput.button);

    window.webContents.sendInputEvent({
      button,
      clickCount,
      type: 'mouseMove',
      x: parsedInput.x,
      y: parsedInput.y,
    });
    window.webContents.sendInputEvent({
      button,
      clickCount,
      type: 'mouseDown',
      x: parsedInput.x,
      y: parsedInput.y,
    });
    window.webContents.sendInputEvent({
      button,
      clickCount,
      type: 'mouseUp',
      x: parsedInput.x,
      y: parsedInput.y,
    });
  }

  private normalizeModifiers(modifiers: ComputerUseKeyModifier[] | undefined) {
    if (modifiers !== undefined && !Array.isArray(modifiers)) {
      throw new Error('pressKey modifiers must be an array');
    }

    const normalized = new Set<'alt' | 'control' | 'meta' | 'shift'>();

    for (const modifier of (modifiers || []).slice(0, 8)) {
      if (modifier === 'ctrl') {
        normalized.add('control');
      } else if (modifier === 'cmd' || modifier === 'command') {
        normalized.add('meta');
      } else if (
        modifier === 'alt' ||
        modifier === 'control' ||
        modifier === 'meta' ||
        modifier === 'shift'
      ) {
        normalized.add(modifier);
      }
    }

    return [...normalized];
  }

  private getInputBounds(window: BrowserWindow): Pick<Electron.Rectangle, 'height' | 'width'> {
    const bounds = window.getContentBounds();

    if (bounds.width <= 0 || bounds.height <= 0) {
      throw new Error('MAIN_WINDOW_BOUNDS_UNAVAILABLE');
    }

    return bounds;
  }
}
