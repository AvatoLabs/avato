import type { UIChatMessage } from '@lobechat/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAppEnv = vi.hoisted(() => ({
  APP_URL: 'https://avato.turingmesh.com',
}));

vi.mock('@/envs/app', () => ({
  get appEnv() {
    return mockAppEnv;
  },
}));

const { normalizeMessageFileUrlsForClient } = await import('./normalizeMessageFileUrls');

describe('normalizeMessageFileUrlsForClient', () => {
  beforeEach(() => {
    mockAppEnv.APP_URL = 'https://avato.turingmesh.com';
  });

  it('should rewrite insecure attachment urls to file proxy urls on https app', () => {
    const messages = [
      {
        fileList: [{ id: 'file-1', url: 'http://8.217.101.26:9000/path/doc.pdf' }],
        id: 'msg-1',
        imageList: [{ alt: 'image', id: 'img-1', url: 'http://8.217.101.26:9000/path/img.png' }],
        role: 'user',
        videoList: [{ alt: 'video', id: 'vid-1', url: 'http://8.217.101.26:9000/path/vid.mp4' }],
      },
    ] as UIChatMessage[];

    const result = normalizeMessageFileUrlsForClient(messages);

    expect(result[0].imageList?.[0].url).toBe('https://avato.turingmesh.com/f/img-1');
    expect(result[0].fileList?.[0].url).toBe('https://avato.turingmesh.com/f/file-1');
    expect(result[0].videoList?.[0].url).toBe('https://avato.turingmesh.com/f/vid-1');
  });

  it('should keep secure urls unchanged', () => {
    const messages = [
      {
        id: 'msg-1',
        imageList: [{ alt: 'image', id: 'img-1', url: 'https://cdn.example.com/img.png' }],
        role: 'user',
      },
    ] as UIChatMessage[];

    const result = normalizeMessageFileUrlsForClient(messages);

    expect(result[0].imageList?.[0].url).toBe('https://cdn.example.com/img.png');
  });

  it('should keep insecure urls unchanged on http app', () => {
    mockAppEnv.APP_URL = 'http://localhost:3210';

    const messages = [
      {
        id: 'msg-1',
        imageList: [{ alt: 'image', id: 'img-1', url: 'http://localhost:9000/img.png' }],
        role: 'user',
      },
    ] as UIChatMessage[];

    const result = normalizeMessageFileUrlsForClient(messages);

    expect(result[0].imageList?.[0].url).toBe('http://localhost:9000/img.png');
  });
});
