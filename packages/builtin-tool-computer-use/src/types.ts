export const ComputerUseIdentifier = 'avato-computer-use';

export const ComputerUseApiName = {
  click: 'click',
  doubleClick: 'doubleClick',
  drag: 'drag',
  getDisplays: 'getDisplays',
  pressKey: 'pressKey',
  screenshot: 'screenshot',
  scroll: 'scroll',
  typeText: 'typeText',
} as const;

export type ComputerUseApiNameType = (typeof ComputerUseApiName)[keyof typeof ComputerUseApiName];
