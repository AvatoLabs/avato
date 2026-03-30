import { createStaticStyles, cssVar } from 'antd-style';

export const conversationTextColors = {
  description: `color-mix(in srgb, ${cssVar.colorTextDescription} 72%, ${cssVar.colorText} 28%)`,
  secondary: `color-mix(in srgb, ${cssVar.colorTextSecondary} 78%, ${cssVar.colorText} 22%)`,
} as const;

export const conversationMutedTextStyles = createStaticStyles(({ css }) => ({
  root: css`
    .ant-typography.ant-typography-secondary,
    .ant-typography-secondary {
      color: ${conversationTextColors.secondary} !important;
    }

    .ant-alert-description {
      color: ${conversationTextColors.description};
    }
  `,
}));
