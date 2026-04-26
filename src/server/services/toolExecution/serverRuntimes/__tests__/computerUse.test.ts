import { ComputerUseIdentifier, ComputerUseManifest } from '@lobechat/builtin-tool-computer-use';
import { describe, expect, it, vi } from 'vitest';

import { type ToolExecutionContext } from '../../types';

const mockExecuteToolCall = vi.fn();
vi.mock('../../deviceProxy', () => ({
  deviceProxy: {
    executeToolCall: (...args: any[]) => mockExecuteToolCall(...args),
  },
}));

const { computerUseRuntime } = await import('../computerUse');

describe('computerUseRuntime', () => {
  it('has the correct identifier', () => {
    expect(computerUseRuntime.identifier).toBe(ComputerUseIdentifier);
  });

  it('throws when userId is missing', () => {
    const context: ToolExecutionContext = {
      activeDeviceId: 'device-1',
      toolManifestMap: {},
    };

    expect(() => computerUseRuntime.factory(context)).toThrow(
      'userId is required for Computer Use device proxy execution',
    );
  });

  it('throws when activeDeviceId is missing', () => {
    const context: ToolExecutionContext = {
      toolManifestMap: {},
      userId: 'user-1',
    };

    expect(() => computerUseRuntime.factory(context)).toThrow(
      'activeDeviceId is required for Computer Use device proxy execution',
    );
  });

  it('creates a proxy with a function for each Computer Use API', () => {
    const context: ToolExecutionContext = {
      activeDeviceId: 'device-1',
      toolManifestMap: {},
      userId: 'user-1',
    };

    const proxy = computerUseRuntime.factory(context);

    for (const api of ComputerUseManifest.api) {
      expect(proxy[api.name]).toBeDefined();
      expect(typeof proxy[api.name]).toBe('function');
    }
  });

  it('calls deviceProxy.executeToolCall with the computer use identifier', async () => {
    const context: ToolExecutionContext = {
      activeDeviceId: 'device-1',
      toolManifestMap: {},
      userId: 'user-1',
    };
    mockExecuteToolCall.mockResolvedValue({
      content: JSON.stringify({ success: true }),
      success: true,
    });

    const proxy = computerUseRuntime.factory(context);
    const result = await proxy.click({ x: 10, y: 20 });

    expect(mockExecuteToolCall).toHaveBeenCalledWith(
      { deviceId: 'device-1', userId: 'user-1' },
      {
        apiName: 'click',
        arguments: JSON.stringify({ x: 10, y: 20 }),
        identifier: ComputerUseIdentifier,
      },
    );
    expect(result).toMatchObject({ success: true });
  });

  it('returns screenshot image URLs through state without echoing raw base64 in content', async () => {
    const context: ToolExecutionContext = {
      activeDeviceId: 'device-1',
      processContentBlocks: vi.fn(async () => [
        { data: 'https://files.example.com/screenshot.jpg', mimeType: 'image/jpeg', type: 'image' },
      ]),
      toolManifestMap: {},
      userId: 'user-1',
    };
    mockExecuteToolCall.mockResolvedValue({
      content: JSON.stringify({
        base64: Buffer.from('image').toString('base64'),
        height: 720,
        mediaType: 'image/jpeg',
        source: 'main-window',
        success: true,
        width: 1280,
      }),
      success: true,
    });

    const proxy = computerUseRuntime.factory(context);
    const result = await proxy.screenshot({ source: 'main-window' });

    expect(context.processContentBlocks).toHaveBeenCalled();
    expect(result).toMatchObject({
      content: 'Screenshot captured from main-window (1280x720).',
      state: {
        height: 720,
        imageUrl: 'https://files.example.com/screenshot.jpg',
        mediaType: 'image/jpeg',
        source: 'main-window',
        success: true,
        width: 1280,
      },
      success: true,
    });
    expect(result.content).not.toContain(Buffer.from('image').toString('base64'));
    expect(result.state).not.toHaveProperty('base64');
  });
});
