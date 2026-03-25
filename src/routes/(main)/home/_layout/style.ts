import { createStaticStyles } from 'antd-style';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  // 绝对定位容器，占满父容器
  absoluteContainer: css`
    position: absolute;
    inset: 0;
  `,

  // 内容区域 - 深色模式
  contentDark: css`
    overflow: hidden;
    background: linear-gradient(
      165deg,
      ${cssVar.colorBgContainer} 0%,
      var(--content-bg-secondary, ${cssVar.colorBgContainer}) 72%,
      var(--content-bg-secondary, ${cssVar.colorBgContainer}) 100%
    );
  `,

  // 内容区域 - 浅色模式
  contentLight: css`
    overflow: hidden;
    background: var(--content-bg-secondary, ${cssVar.colorBgContainer});
  `,
}));
