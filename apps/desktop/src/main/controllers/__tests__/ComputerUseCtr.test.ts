import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { App } from '@/core/App';

import ComputerUseCtr from '../ComputerUseCtr';

const electronMocks = vi.hoisted(() => ({
  desktopCapturerGetSources: vi.fn(),
  ipcMainHandle: vi.fn(),
  screenGetAllDisplays: vi.fn(),
  screenGetPrimaryDisplay: vi.fn(),
}));

vi.mock('electron', () => ({
  desktopCapturer: {
    getSources: electronMocks.desktopCapturerGetSources,
  },
  ipcMain: {
    handle: electronMocks.ipcMainHandle,
  },
  screen: {
    getAllDisplays: electronMocks.screenGetAllDisplays,
    getPrimaryDisplay: electronMocks.screenGetPrimaryDisplay,
  },
}));

vi.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}));

const createImage = (width = 100, height = 50, content = 'jpeg') => ({
  getSize: vi.fn(() => ({ height, width })),
  isEmpty: vi.fn(() => false),
  resize: vi.fn(() => createImage(width, height, content)),
  toJPEG: vi.fn(() => Buffer.from(content)),
  toPNG: vi.fn(() => Buffer.from(content)),
});

describe('ComputerUseCtr', () => {
  const webContents = {
    focus: vi.fn(),
    insertText: vi.fn(),
    sendInputEvent: vi.fn(),
  };
  const browserWindow = {
    capturePage: vi.fn(),
    focus: vi.fn(),
    isDestroyed: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    restore: vi.fn(),
    webContents,
  };
  const app = {
    browserManager: {
      getMainWindow: vi.fn(() => ({ browserWindow })),
    },
  } as unknown as App;

  let controller: ComputerUseCtr;

  beforeEach(() => {
    vi.clearAllMocks();
    webContents.insertText.mockResolvedValue(undefined);
    browserWindow.capturePage.mockResolvedValue(createImage());
    electronMocks.screenGetAllDisplays.mockReturnValue([
      {
        bounds: { height: 1080, width: 1920, x: 0, y: 0 },
        id: 1,
        label: 'Built-in Display',
        scaleFactor: 2,
        size: { height: 1080, width: 1920 },
        workArea: { height: 1040, width: 1920, x: 0, y: 40 },
      },
    ]);
    electronMocks.screenGetPrimaryDisplay.mockReturnValue({
      bounds: { height: 1080, width: 1920, x: 0, y: 0 },
      id: 1,
      label: 'Built-in Display',
      scaleFactor: 2,
      size: { height: 1080, width: 1920 },
      workArea: { height: 1040, width: 1920, x: 0, y: 40 },
    });
    electronMocks.desktopCapturerGetSources.mockResolvedValue([
      {
        display_id: '1',
        id: 'screen:1',
        name: 'Built-in Display',
        thumbnail: createImage(1280, 720, 'screen'),
      },
    ]);
    controller = new ComputerUseCtr(app);
  });

  it('captures the main window as a bounded jpeg screenshot', async () => {
    const result = await controller.screenshot({ source: 'main-window' });

    expect(result).toMatchObject({
      base64: Buffer.from('jpeg').toString('base64'),
      height: 50,
      mediaType: 'image/jpeg',
      source: 'main-window',
      success: true,
      width: 100,
    });
    expect(browserWindow.capturePage).toHaveBeenCalled();
  });

  it('captures a selected screen source', async () => {
    const result = await controller.screenshot({
      displayId: 1,
      maxHeight: 720,
      maxWidth: 1280,
      source: 'screen',
    });

    expect(result).toMatchObject({
      base64: Buffer.from('screen').toString('base64'),
      displayId: '1',
      mediaType: 'image/jpeg',
      scaleFactor: 2,
      source: 'screen',
      success: true,
    });
    expect(electronMocks.desktopCapturerGetSources).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnailSize: { height: 720, width: 1280 },
        types: ['screen'],
      }),
    );
  });

  it('sends click events into the focused main window', async () => {
    await controller.click({ x: 42, y: 24 });

    expect(browserWindow.focus).toHaveBeenCalled();
    expect(webContents.focus).toHaveBeenCalled();
    expect(webContents.sendInputEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ button: 'left', type: 'mouseMove', x: 42, y: 24 }),
    );
    expect(webContents.sendInputEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ button: 'left', type: 'mouseDown', x: 42, y: 24 }),
    );
    expect(webContents.sendInputEvent).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ button: 'left', type: 'mouseUp', x: 42, y: 24 }),
    );
  });

  it('types text through the focused webContents', async () => {
    await controller.typeText({ text: 'hello' });

    expect(webContents.insertText).toHaveBeenCalledWith('hello');
  });

  it('presses keys with normalized modifiers', async () => {
    await controller.pressKey({ key: 'A', modifiers: ['cmd', 'shift'] });

    expect(webContents.sendInputEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ keyCode: 'A', modifiers: ['meta', 'shift'], type: 'keyDown' }),
    );
    expect(webContents.sendInputEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ keyCode: 'A', modifiers: ['meta', 'shift'], type: 'keyUp' }),
    );
  });
});
