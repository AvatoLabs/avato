'use client';

import { Flexbox, Text } from '@lobehub/ui';
import { cssVar } from 'antd-style';
import { memo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  getWorkspaceSubSidebarTitleMarginInlineStartPx,
  WORKSPACE_SUB_SIDEBAR_BACK_BUTTON_BLOCK_PX,
  WORKSPACE_SUB_SIDEBAR_BACK_TITLE_GAP_PX,
  WORKSPACE_SUB_SIDEBAR_ROW_PADDING_INLINE_PX,
  WORKSPACE_SUB_SIDEBAR_TITLE_BAR_MIN_HEIGHT_PX,
} from '@/const/workspaceVisualTokens';

import { useGlassNavVisual } from '../GlassNavVisualContext';
import BackButton from './BackButton';

export interface SubSidebarTitleBarProps {
  /** 返回按钮目标路径 */
  backTo?: string;
  /** 返回按钮是否使用浏览器历史记录 */
  backUseHistory?: boolean;
  /** 右侧区域（如回收站、操作按钮） */
  right?: ReactNode;
  /** 是否显示返回按钮；独立 surface 可以关闭 */
  showBackButton?: boolean;
  /** 当前子侧栏标题（与主导航 tab 文案一致） */
  title: ReactNode;
  /** 点击标题跳转至该分区根路径；不传则仅展示文字 */
  titleTo?: string;
}

/** 子侧栏顶栏：返回首页 + 分区标题，避免子路由无法回到主导航 */
const SubSidebarTitleBar = memo<SubSidebarTitleBarProps>(
  ({ backUseHistory = false, backTo = '/', right, showBackButton = true, title, titleTo }) => {
    const { t } = useTranslation('common');
    const glass = useGlassNavVisual();
    const titleMarginStart = showBackButton
      ? getWorkspaceSubSidebarTitleMarginInlineStartPx(glass)
      : 0;
    const titleText =
      typeof title === 'number' || typeof title === 'string' ? String(title) : undefined;

    const titleStyles = {
      color: 'inherit' as const,
      display: 'flex' as const,
      flex: 1,
      lineHeight: 1.28,
      marginInlineStart: titleMarginStart,
      minWidth: 0,
      textDecoration: 'none' as const,
    };

    const titleNode = (
      <Text
        ellipsis
        fontSize={cssVar.fontSizeLG}
        title={titleText}
        weight={500}
        style={{
          color: cssVar.colorTextHeading,
          letterSpacing: '0.02em',
          lineHeight: 1.28,
        }}
      >
        {title}
      </Text>
    );

    return (
      <Flexbox
        horizontal
        align={'center'}
        flex={'none'}
        justify={'space-between'}
        paddingBlock={6}
        paddingInline={WORKSPACE_SUB_SIDEBAR_ROW_PADDING_INLINE_PX}
        style={{ minHeight: WORKSPACE_SUB_SIDEBAR_TITLE_BAR_MIN_HEIGHT_PX }}
      >
        <Flexbox
          horizontal
          align={'center'}
          flex={1}
          gap={WORKSPACE_SUB_SIDEBAR_BACK_TITLE_GAP_PX}
          style={{ minWidth: 0 }}
        >
          {showBackButton && (
            <BackButton
              title={t('back')}
              to={backTo}
              useHistory={backUseHistory}
              size={{
                blockSize: WORKSPACE_SUB_SIDEBAR_BACK_BUTTON_BLOCK_PX,
                size: 18,
              }}
            />
          )}
          {titleTo ? (
            <Link style={titleStyles} to={titleTo}>
              {titleNode}
            </Link>
          ) : (
            <Flexbox flex={1} style={{ marginInlineStart: titleMarginStart, minWidth: 0 }}>
              {titleNode}
            </Flexbox>
          )}
        </Flexbox>
        {right ? <Flexbox flex={'none'}>{right}</Flexbox> : null}
      </Flexbox>
    );
  },
);

SubSidebarTitleBar.displayName = 'SubSidebarTitleBar';

export default SubSidebarTitleBar;
