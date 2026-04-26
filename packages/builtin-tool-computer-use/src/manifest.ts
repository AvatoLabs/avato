import { type BuiltinToolManifest } from '@lobechat/types';

import { systemPrompt } from './systemRole';
import { ComputerUseApiName, ComputerUseIdentifier } from './types';

export const ComputerUseManifest: BuiltinToolManifest = {
  api: [
    {
      description:
        'Capture a screenshot from the activated Avato Desktop device. Defaults to the Avato main window. Returns image metadata and base64 data.',
      name: ComputerUseApiName.screenshot,
      parameters: {
        additionalProperties: false,
        properties: {
          displayId: {
            description: 'Optional display id when source is screen',
            type: ['string', 'number'],
          },
          format: {
            description: 'Image format. Defaults to jpeg.',
            enum: ['jpeg', 'png'],
            type: 'string',
          },
          maxHeight: {
            description: 'Maximum output image height. Defaults to 900.',
            type: 'number',
          },
          maxWidth: {
            description: 'Maximum output image width. Defaults to 1280.',
            type: 'number',
          },
          quality: { description: 'JPEG quality from 1 to 100. Defaults to 70.', type: 'number' },
          source: {
            description:
              'Screenshot source. Use main-window unless screen capture is explicitly needed.',
            enum: ['main-window', 'screen'],
            type: 'string',
          },
        },
        type: 'object',
      },
    },
    {
      description: 'List displays available on the activated desktop device.',
      name: ComputerUseApiName.getDisplays,
      parameters: { additionalProperties: false, properties: {}, type: 'object' },
    },
    {
      description: 'Click at window-relative coordinates on the activated Avato Desktop window.',
      name: ComputerUseApiName.click,
      parameters: {
        additionalProperties: false,
        properties: {
          button: { enum: ['left', 'middle', 'right'], type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
        },
        required: ['x', 'y'],
        type: 'object',
      },
    },
    {
      description:
        'Double-click at window-relative coordinates on the activated Avato Desktop window.',
      name: ComputerUseApiName.doubleClick,
      parameters: {
        additionalProperties: false,
        properties: {
          button: { enum: ['left', 'middle', 'right'], type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' },
        },
        required: ['x', 'y'],
        type: 'object',
      },
    },
    {
      description:
        'Drag from one window-relative point to another on the activated Avato Desktop window.',
      name: ComputerUseApiName.drag,
      parameters: {
        additionalProperties: false,
        properties: {
          button: { enum: ['left', 'middle', 'right'], type: 'string' },
          from: {
            additionalProperties: false,
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
            type: 'object',
          },
          steps: { description: 'Optional interpolation step count.', type: 'number' },
          to: {
            additionalProperties: false,
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
            type: 'object',
          },
        },
        required: ['from', 'to'],
        type: 'object',
      },
    },
    {
      description: 'Scroll at window-relative coordinates on the activated Avato Desktop window.',
      name: ComputerUseApiName.scroll,
      parameters: {
        additionalProperties: false,
        properties: {
          deltaX: { type: 'number' },
          deltaY: { type: 'number' },
          x: { type: 'number' },
          y: { type: 'number' },
        },
        required: ['x', 'y'],
        type: 'object',
      },
    },
    {
      description: 'Type text into the focused element in the activated Avato Desktop window.',
      name: ComputerUseApiName.typeText,
      parameters: {
        additionalProperties: false,
        properties: { text: { type: 'string' } },
        required: ['text'],
        type: 'object',
      },
    },
    {
      description: 'Press a key in the activated Avato Desktop window.',
      name: ComputerUseApiName.pressKey,
      parameters: {
        additionalProperties: false,
        properties: {
          key: {
            description: 'Electron keyCode, such as Enter, Escape, Tab, A, ArrowDown.',
            type: 'string',
          },
          modifiers: {
            items: {
              enum: ['alt', 'cmd', 'command', 'control', 'ctrl', 'meta', 'shift'],
              type: 'string',
            },
            type: 'array',
          },
        },
        required: ['key'],
        type: 'object',
      },
    },
  ],
  humanIntervention: 'never',
  identifier: ComputerUseIdentifier,
  meta: {
    avatar: '🖱️',
    description: 'Observe and control the activated Avato Desktop window through Device Gateway',
    readme:
      'Remote Computer Use lets an authorized same-account Web or mobile session capture the Avato Desktop window and send clicks, typing, scrolling, and key presses to it.',
    title: 'Remote Computer Use',
  },
  systemRole: systemPrompt,
  type: 'builtin',
};
