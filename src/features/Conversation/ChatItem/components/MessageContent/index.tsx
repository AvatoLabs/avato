import { Flexbox } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { type ReactNode } from 'react';
import { memo, Suspense, useCallback } from 'react';

import { useConversationStore } from '@/features/Conversation/store';
import dynamic from '@/libs/next/dynamic';

import { type ChatItemProps } from '../../type';

const EditorModal = dynamic(
  () => import('@/features/EditorModal').then((mode) => mode.EditorModal),
  { ssr: false },
);

export const MSG_CONTENT_CLASSNAME = 'msg_content_flag';

export const styles = createStaticStyles(({ css, cssVar }) => {
  return {
    bubble: css`
      padding-block: 10px;
      padding-inline: 14px;
      border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, transparent);
      border-radius: 20px 20px 10px;

      background: linear-gradient(
        180deg,
        color-mix(in srgb, ${cssVar.colorBgElevated} 96%, ${cssVar.colorFillQuaternary}) 0%,
        color-mix(in srgb, ${cssVar.colorFillQuaternary} 82%, ${cssVar.colorBgContainer}) 100%
      );
      box-shadow:
        inset 0 1px 0 color-mix(in srgb, ${cssVar.colorTextLightSolid} 12%, transparent),
        0 16px 30px -26px color-mix(in srgb, ${cssVar.colorText} 24%, transparent);
    `,
    disabled: css`
      user-select: ${'none'};
      color: color-mix(in srgb, ${cssVar.colorTextSecondary} 78%, ${cssVar.colorText} 22%);
    `,
    message: css`
      position: relative;
      overflow: hidden;
      max-width: 100%;
    `,
  };
});

export interface MessageContentProps {
  children?: ReactNode;
  className?: string;
  disabled?: ChatItemProps['disabled'];
  editing?: ChatItemProps['editing'];
  id: string;
  message?: ReactNode;
  messageExtra?: ChatItemProps['messageExtra'];
  onDoubleClick?: ChatItemProps['onDoubleClick'];
  variant?: 'bubble' | 'default';
}

const MessageContent = memo<MessageContentProps>(
  ({
    editing,
    id,
    message,
    messageExtra,
    children,
    onDoubleClick,
    disabled,
    className,
    variant,
  }) => {
    const [toggleMessageEditing, updateMessageContent] = useConversationStore((s) => [
      s.toggleMessageEditing,
      s.updateMessageContent,
    ]);

    const onEditingChange = useCallback(
      (edit: boolean) => toggleMessageEditing(id, edit),
      [id, toggleMessageEditing],
    );

    return (
      <>
        <Flexbox
          gap={16}
          className={cx(
            MSG_CONTENT_CLASSNAME,
            styles.message,
            variant === 'bubble' && styles.bubble,
            disabled && styles.disabled,
            className,
          )}
          onDoubleClick={onDoubleClick}
        >
          {children || message}
          {messageExtra}
        </Flexbox>
        <Suspense fallback={null}>
          {editing && (
            <EditorModal
              open={editing}
              value={message ? String(message) : ''}
              onCancel={() => onEditingChange(false)}
              onConfirm={async (value) => {
                await updateMessageContent(id, value);
                onEditingChange(false);
              }}
            />
          )}
        </Suspense>
      </>
    );
  },
);

export default MessageContent;
