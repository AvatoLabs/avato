import { SendButton as Send } from '@lobehub/editor/react';
import { createStyles } from 'antd-style';
import isEqual from 'fast-deep-equal';
import { ArrowUp } from 'lucide-react';
import { memo, useMemo } from 'react';

import { selectors, useChatInputStore } from '../store';

/** 主色发送键：跟随主题 colorPrimary，字与图标用按背景对比度校正后的 colorTextLightSolid */
const useStyles = createStyles(({ css, token }) => ({
  primarySendIcon: css`
    &.ant-btn-primary:not(.ant-btn-disabled),
    & .ant-btn-primary:not(.ant-btn-disabled) {
      color: ${token.colorTextLightSolid} !important;
    }

    &.ant-btn-primary:not(.ant-btn-disabled) .anticon,
    &.ant-btn-primary:not(.ant-btn-disabled) svg,
    & .ant-btn-primary:not(.ant-btn-disabled) .anticon,
    & .ant-btn-primary:not(.ant-btn-disabled) svg {
      color: ${token.colorTextLightSolid} !important;
    }
  `,
  chatgptSend: css`
    &.ant-btn-primary:not(.ant-btn-disabled) {
      border-color: ${token.colorPrimary} !important;
      color: ${token.colorTextLightSolid} !important;
      background: ${token.colorPrimary} !important;
      box-shadow: none;
    }

    &.ant-btn-primary:not(.ant-btn-disabled):hover {
      border-color: ${token.colorPrimaryHover} !important;
      color: ${token.colorTextLightSolid} !important;
      background: ${token.colorPrimaryHover} !important;
    }

    &.ant-btn-primary:not(.ant-btn-disabled):active {
      filter: brightness(0.92);
    }
  `,
}));

const SendButton = memo(() => {
  const sendMenu = useChatInputStore((s) => s.sendMenu);
  const shape = useChatInputStore((s) => s.sendButtonProps?.shape);
  const size = useChatInputStore((s) => s.sendButtonProps?.size);
  const variant = useChatInputStore((s) => s.sendButtonProps?.variant ?? 'default');
  const { generating, disabled } = useChatInputStore(selectors.sendButtonProps, isEqual);
  const [send, handleStop] = useChatInputStore((s) => [s.handleSendButton, s.handleStop]);

  const { styles, cx, theme } = useStyles();
  const chatgptIcon = useMemo(() => {
    const px = size ? Math.round(size * 0.5) : 18;
    return <ArrowUp aria-hidden color={theme.colorTextLightSolid} size={px} strokeWidth={2.75} />;
  }, [size, theme.colorTextLightSolid]);

  const isChatgpt = variant === 'chatgpt' && !sendMenu;

  return (
    <Send
      {...(isChatgpt
        ? ({
            // Send merges rest after internal props; `icon` overrides default paper-plane (non-dropdown only)
            icon: chatgptIcon,
          } as Record<string, unknown>)
        : {})}
      className={cx(styles.primarySendIcon, isChatgpt && styles.chatgptSend)}
      disabled={disabled}
      generating={generating}
      menu={sendMenu as any}
      placement={'topRight'}
      shape={shape}
      size={size}
      trigger={['hover']}
      onClick={() => send()}
      onStop={() => handleStop()}
    />
  );
});

SendButton.displayName = 'SendButton';

export default SendButton;
