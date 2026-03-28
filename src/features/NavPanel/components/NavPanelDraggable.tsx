'use client';

import { DraggablePanel, type DraggablePanelProps, Freeze } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { AnimatePresence, motion, useIsPresent } from 'motion/react';
import { type ReactNode } from 'react';
import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react';

import { isDesktop } from '@/const/version';
import {
  WORKSPACE_DURATION_NORMAL_MS,
  WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX,
  WORKSPACE_SHELL_RAIL_MIN_WIDTH,
} from '@/const/workspaceVisualTokens';
import { TOGGLE_BUTTON_ID } from '@/features/NavPanel/ToggleLeftPanelButton';
import { USER_DROPDOWN_ICON_ID } from '@/routes/(main)/home/_layout/Header/components/User';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useUserStore } from '@/store/user';
import { userGeneralSettingsSelectors } from '@/store/user/selectors';
import { isMacOS } from '@/utils/platform';

import { GlassNavVisualProvider } from '../GlassNavVisualContext';
import { glassSidebarStyles } from '../glassSidebar.styles';
import { useNavPanelSizeChangeHandler } from '../hooks/useNavPanel';
import MiniWorkspaceRail from '../MiniWorkspaceRail';
import { BACK_BUTTON_ID } from './BackButton';

type MotionDirection = -1 | 0 | 1;

const MOTION_OFFSET = 8;

/** Same control points as {@link WORKSPACE_EASE_STANDARD} (`cubic-bezier(0.4, 0, 0.2, 1)`) */
const MOTION_EASE = [0.4, 0, 0.2, 1] as const;

const isMotionDisabled = (mode?: string) => mode === 'disabled';

const getMotionDirectionByHistory = (history: string[], nextKey: string): MotionDirection => {
  const currentKey = history.at(-1);
  if (currentKey === nextKey) return 0;

  return history.includes(nextKey) ? -1 : 1;
};

const motionVariants = {
  animate: { opacity: 1, x: 0 },
  exit: (direction: MotionDirection) => ({
    opacity: 0,
    x: -direction * MOTION_OFFSET,
  }),
  initial: (direction: MotionDirection) => ({
    opacity: 0,
    x: direction * MOTION_OFFSET,
  }),
  transition: {
    duration: WORKSPACE_DURATION_NORMAL_MS / 1000,
    ease: MOTION_EASE,
  },
} as const;

const draggableStyles = createStaticStyles(({ css, cssVar }) => ({
  content: css`
    position: relative;

    overflow: hidden;
    display: flex;

    height: 100%;
    min-height: 100%;
    max-height: 100%;
  `,
  inner: css`
    position: relative;

    overflow: hidden;
    flex: 1;

    min-width: ${WORKSPACE_SHELL_RAIL_MIN_WIDTH}px;
    max-width: 100%;
    min-height: 100%;
    max-height: 100%;
  `,
  layer: css`
    will-change: opacity, transform;

    position: absolute;
    inset: 0;

    overflow: hidden;
    display: flex;
    flex-direction: column;

    min-width: ${WORKSPACE_SHELL_RAIL_MIN_WIDTH}px;
    max-width: 100%;
    min-height: 100%;
    max-height: 100%;
  `,
  innerMini: css`
    min-width: ${WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX}px !important;
    max-width: ${WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX}px !important;
  `,
  layerMini: css`
    min-width: ${WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX}px !important;
    max-width: ${WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX}px !important;
  `,
  panel: css`
    user-select: none;

    height: 100%;

    color: ${cssVar.colorText};

    background: ${isDesktop && isMacOS() ? 'transparent' : cssVar.colorBgLayout};
    box-shadow: inset -1px 0 0 ${cssVar.colorBorderSecondary};

    * {
      user-select: none;
    }

    #${TOGGLE_BUTTON_ID} {
      width: 32px !important;
      opacity: 0.72;
      transition:
        opacity,
        width 0.2s ${cssVar.motionEaseOut};
    }

    #${USER_DROPDOWN_ICON_ID} {
      width: 0 !important;
      opacity: 0;
      transition:
        opacity,
        width 0.2s ${cssVar.motionEaseOut};
    }
    #${BACK_BUTTON_ID} {
      width: 32px !important;
    }

    &:hover {
      #${TOGGLE_BUTTON_ID} {
        width: 32px !important;
        opacity: 1;
      }

      #${USER_DROPDOWN_ICON_ID} {
        width: 16px !important;
        opacity: 1;
      }
    }
  `,
}));

interface NavPanelDraggableProps {
  activeContent: {
    key: string;
    node: ReactNode;
  };
}

interface ExitingFrozenContentProps {
  children: ReactNode;
}

const draggablePanelClassNames = {
  content: draggableStyles.content,
};

const ExitingFrozenContent = memo<ExitingFrozenContentProps>(({ children }) => {
  const isPresent = useIsPresent();

  return <Freeze frozen={!isPresent}>{children}</Freeze>;
});

ExitingFrozenContent.displayName = 'ExitingFrozenContent';

export const NavPanelDraggable = memo<NavPanelDraggableProps>(({ activeContent }) => {
  const [expand, leftPanelCollapsed, leftPanelWidth] = useGlobalStore((s) => [
    systemStatusSelectors.showLeftPanel(s),
    s.status.leftPanelCollapsed ?? false,
    systemStatusSelectors.leftPanelWidth(s),
  ]);
  const animationMode = useUserStore(userGeneralSettingsSelectors.animationMode);
  const shouldUseMotion = !isMotionDisabled(animationMode);
  const persistNavWidth = useNavPanelSizeChangeHandler();
  const handleSizeChange = useCallback<NonNullable<DraggablePanelProps['onSizeDragging']>>(
    (delta, size) => {
      if (useGlobalStore.getState().status.leftPanelCollapsed) return;
      persistNavWidth(delta, size);
    },
    [persistNavWidth],
  );

  const panelWidth = useMemo(() => {
    if (!expand) return 0;
    return leftPanelCollapsed ? WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX : leftPanelWidth;
  }, [expand, leftPanelCollapsed, leftPanelWidth]);

  const defaultWidthRef = useRef(0);
  if (defaultWidthRef.current === 0) {
    defaultWidthRef.current = systemStatusSelectors.leftPanelWidth(useGlobalStore.getState());
  }

  const defaultSize = useMemo(
    () => ({
      height: '100%',
      width: defaultWidthRef.current,
    }),
    [],
  );
  const styles = useMemo(
    () => ({
      transition: `width ${WORKSPACE_DURATION_NORMAL_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      zIndex: 11,
    }),
    [],
  );

  const historyRef = useRef([activeContent.key]);
  const directionRef = useRef<MotionDirection>(0);

  const history = historyRef.current;
  const direction = shouldUseMotion ? getMotionDirectionByHistory(history, activeContent.key) : 0;
  if (direction !== 0) {
    directionRef.current = direction;
  }

  useLayoutEffect(() => {
    if (!shouldUseMotion) return;

    const snapshot = historyRef.current;
    const currentKey = snapshot.at(-1);
    const nextKey = activeContent.key;

    if (currentKey === nextKey) return;

    const existingIndex = snapshot.lastIndexOf(nextKey);
    if (existingIndex !== -1) {
      snapshot.splice(existingIndex + 1);
      return;
    }

    snapshot.push(nextKey);
  }, [activeContent.key, shouldUseMotion]);

  const motionDirection = shouldUseMotion ? directionRef.current : 0;

  return (
    <DraggablePanel
      className={cx(draggableStyles.panel, glassSidebarStyles.draggablePanelGlass)}
      classNames={draggablePanelClassNames}
      defaultSize={defaultSize}
      expand={expand}
      expandable={false}
      maxWidth={leftPanelCollapsed ? WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX : 400}
      placement="left"
      resize={!expand || leftPanelCollapsed ? false : undefined}
      showBorder={false}
      size={expand ? { height: '100%', width: panelWidth } : undefined}
      style={styles}
      minWidth={
        leftPanelCollapsed ? WORKSPACE_LEFT_PANEL_MINI_WIDTH_PX : WORKSPACE_SHELL_RAIL_MIN_WIDTH
      }
      onSizeDragging={handleSizeChange}
    >
      <div className={cx(draggableStyles.inner, leftPanelCollapsed && draggableStyles.innerMini)}>
        {leftPanelCollapsed ? (
          <div className={cx(draggableStyles.layer, draggableStyles.layerMini)}>
            <GlassNavVisualProvider>
              <MiniWorkspaceRail />
            </GlassNavVisualProvider>
          </div>
        ) : shouldUseMotion ? (
          <AnimatePresence custom={motionDirection} initial={false} mode="wait">
            <motion.div
              animate="animate"
              className={draggableStyles.layer}
              custom={motionDirection}
              exit="exit"
              initial="initial"
              key={activeContent.key}
              transition={motionVariants.transition}
              variants={motionVariants}
            >
              <ExitingFrozenContent>
                <GlassNavVisualProvider>{activeContent.node}</GlassNavVisualProvider>
              </ExitingFrozenContent>
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className={draggableStyles.layer} key={activeContent.key}>
            <GlassNavVisualProvider>{activeContent.node}</GlassNavVisualProvider>
          </div>
        )}
      </div>
    </DraggablePanel>
  );
});
