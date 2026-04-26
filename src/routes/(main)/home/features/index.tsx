'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Block, Flexbox, Text } from '@lobehub/ui';
import { createStaticStyles, cx } from 'antd-style';
import { GripVertical, LayoutGrid } from 'lucide-react';
import { memo, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  WORKSPACE_HOME_COLUMN_MAX_WIDTH_PX,
  WORKSPACE_HOME_SECTION_GAP_PX,
} from '@/const/workspaceVisualTokens';
import { homeRecentSelectors } from '@/store/home/selectors';
import { useHomeStore } from '@/store/home/store';

import CommunityRecommend from './CommunityRecommend';
import FeaturedPlugins from './FeaturedPlugins';
import InputArea from './InputArea';
import RecentPage from './RecentPage';
import RecentResource from './RecentResource';
import SuggestQuestions from './SuggestQuestions';

const HOME_PANEL_ORDER_STORAGE_KEY = 'lobehub.home.panel-order.v1';

type HomePanelId = 'community' | 'examples' | 'recentDocs' | 'recentFiles' | 'skills';
type HomePanelSpan = 'full' | 'wide';

interface HomePanelDefinition {
  id: HomePanelId;
  node: ReactNode;
  span: HomePanelSpan;
}

const DEFAULT_PANEL_ORDER: HomePanelId[] = [
  'recentDocs',
  'examples',
  'recentFiles',
  'skills',
  'community',
];

const styles = createStaticStyles(({ css, cssVar }) => ({
  contentGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(420px, 100%), 1fr));
    gap: 16px;
    width: 100%;
  `,
  dragHandle: css`
    cursor: grab;

    display: inline-flex;
    align-items: center;
    justify-content: center;

    width: 24px;
    height: 24px;
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 64%, transparent);
    border-radius: 999px;

    color: color-mix(in srgb, ${cssVar.colorTextDescription} 86%, ${cssVar.colorText} 14%);

    opacity: 0.68;
    background: color-mix(in srgb, ${cssVar.colorBgElevated} 90%, ${cssVar.colorBgContainer} 10%);
    box-shadow: 0 16px 32px -24px color-mix(in srgb, ${cssVar.colorText} 68%, transparent);

    transition:
      transform ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      opacity ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationMid} ${cssVar.motionEaseOut};

    &:active {
      cursor: grabbing;
      transform: scale(0.96);
    }

    &:hover {
      border-color: color-mix(
        in srgb,
        ${cssVar.colorPrimaryBorder} 24%,
        ${cssVar.colorBorderSecondary} 76%
      );
      color: ${cssVar.colorText};
      opacity: 1;
    }
  `,
  heroCard: css`
    isolation: isolate;
    position: relative;

    overflow: hidden;

    padding: clamp(20px, 2vw, 28px);
    border: 1px solid
      color-mix(in srgb, ${cssVar.colorBorderSecondary} 72%, ${cssVar.colorBorder} 28%);
    border-radius: 30px;

    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorBgContainer} 98%, ${cssVar.colorFillTertiary} 2%) 0%,
      color-mix(in srgb, ${cssVar.colorBgElevated} 95%, ${cssVar.colorFillQuaternary} 5%) 100%
    );
    box-shadow: 0 28px 56px -42px color-mix(in srgb, ${cssVar.colorText} 22%, transparent);

    &::before {
      pointer-events: none;
      content: '';

      position: absolute;
      inset-block-start: -120px;
      inset-inline-end: -120px;

      width: 320px;
      height: 320px;
      border-radius: 999px;

      opacity: 0.42;
      background: radial-gradient(
        circle,
        color-mix(in srgb, ${cssVar.colorPrimaryBg} 22%, transparent) 0%,
        transparent 72%
      );
    }
  `,
  heroDescription: css`
    max-width: 70ch;
    font-size: 14px;
    line-height: 1.62;
    color: color-mix(in srgb, ${cssVar.colorTextSecondary} 82%, ${cssVar.colorText} 18%);
  `,
  heroLead: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: min(100%, 860px);
  `,
  heroSection: css`
    position: relative;
    z-index: 1;

    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  heroTitle: css`
    max-width: 12ch;

    font-size: clamp(34px, 4.4vw, 46px);
    font-weight: 700;
    line-height: 0.98;
    color: ${cssVar.colorText};
    letter-spacing: -0.04em;

    @media (width <= 768px) {
      max-width: 100%;
      font-size: 30px;
    }
  `,
  panelDragging: css`
    z-index: 2;
    box-shadow: 0 26px 48px -34px color-mix(in srgb, ${cssVar.colorText} 28%, transparent);
  `,
  panelFrame: css`
    position: relative;

    min-width: 0;
    padding: clamp(14px, 1.4vw, 18px);
    border: 1px solid color-mix(in srgb, ${cssVar.colorBorderSecondary} 58%, transparent);
    border-radius: 22px;

    background: linear-gradient(
      180deg,
      color-mix(in srgb, ${cssVar.colorBgContainer} 98%, ${cssVar.colorFillTertiary} 2%) 0%,
      color-mix(in srgb, ${cssVar.colorBgElevated} 96%, ${cssVar.colorFillQuaternary} 4%) 100%
    );
    box-shadow: 0 20px 40px -34px color-mix(in srgb, ${cssVar.colorText} 16%, transparent);

    transition:
      transform ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      box-shadow ${cssVar.motionDurationMid} ${cssVar.motionEaseOut},
      border-color ${cssVar.motionDurationMid} ${cssVar.motionEaseOut};

    &:hover {
      transform: translateY(-1px);
      border-color: color-mix(
        in srgb,
        ${cssVar.colorPrimaryBorder} 18%,
        ${cssVar.colorBorderSecondary} 82%
      );
      box-shadow: 0 24px 44px -34px color-mix(in srgb, ${cssVar.colorText} 20%, transparent);
    }
  `,
  panelFull: css`
    grid-column: 1 / -1;
  `,
  panelOver: css`
    border-color: color-mix(
      in srgb,
      ${cssVar.colorPrimaryBorder} 36%,
      ${cssVar.colorBorderSecondary} 64%
    );
  `,
  panelToolbar: css`
    position: absolute;
    z-index: 2;
    inset-block-start: -10px;
    inset-inline-end: 16px;
  `,
  panelWide: css`
    grid-column: auto;
  `,
  sectionHeader: css`
    display: flex;
    gap: 12px;
    align-items: center;
    width: 100%;
  `,
  sectionLabel: css`
    display: inline-flex;
    gap: 8px;
    align-items: center;

    font-size: 12px;
    font-weight: 600;
    color: color-mix(in srgb, ${cssVar.colorTextDescription} 92%, ${cssVar.colorTextSecondary} 8%);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
  `,
  sectionRule: css`
    flex: 1;
    min-width: 0;
    height: 1px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, ${cssVar.colorBorderSecondary} 58%, transparent) 0%,
      transparent 100%
    );
  `,
  workspaceRoot: css`
    width: 100%;
    max-width: ${WORKSPACE_HOME_COLUMN_MAX_WIDTH_PX}px;
    margin-inline: auto;
  `,
}));

const normalizePanelOrder = (panelIds: HomePanelId[], candidate?: unknown): HomePanelId[] => {
  if (!Array.isArray(candidate)) return panelIds;

  const validIds = candidate.filter((id): id is HomePanelId =>
    panelIds.includes(id as HomePanelId),
  );
  const missingIds = panelIds.filter((id) => !validIds.includes(id));

  return [...validIds, ...missingIds];
};

interface DraggableHomePanelProps {
  children: ReactNode;
  id: HomePanelId;
  span: HomePanelSpan;
}

const DraggableHomePanel = memo<DraggableHomePanelProps>(({ id, span, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableNodeRef,
    transform,
    isDragging,
  } = useDraggable({ id });
  const { isOver, setNodeRef: setDroppableNodeRef } = useDroppable({ id });

  const setNodeRef = useCallback(
    (node: HTMLDivElement | null) => {
      setDraggableNodeRef(node);
      setDroppableNodeRef(node);
    },
    [setDraggableNodeRef, setDroppableNodeRef],
  );

  return (
    <div
      ref={setNodeRef}
      className={cx(
        styles.panelFrame,
        span === 'full' ? styles.panelFull : styles.panelWide,
        isDragging && styles.panelDragging,
        isOver && styles.panelOver,
      )}
      style={
        transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined
      }
    >
      <div className={styles.panelToolbar}>
        <button
          aria-label="Drag to reorder"
          className={styles.dragHandle}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={14} strokeWidth={2} />
        </button>
      </div>
      {children}
    </div>
  );
});

DraggableHomePanel.displayName = 'DraggableHomePanel';

const Home = memo(() => {
  const { t } = useTranslation(['home']);
  const [recentPages, recentResources, isRecentPagesInit, isRecentResourcesInit] = useHomeStore(
    (s) => [
      homeRecentSelectors.recentPages(s),
      homeRecentSelectors.recentResources(s),
      homeRecentSelectors.isRecentPagesInit(s),
      homeRecentSelectors.isRecentResourcesInit(s),
    ],
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
  );

  const contentMode = 'agent';
  const showRecentDocs = !isRecentPagesInit || (recentPages?.length ?? 0) > 0;
  const showRecentFiles = !isRecentResourcesInit || (recentResources?.length ?? 0) > 0;

  const panels = useMemo<HomePanelDefinition[]>(
    () =>
      [
        showRecentDocs
          ? {
              id: 'recentDocs',
              node: <RecentPage />,
              span: 'wide',
            }
          : null,
        showRecentFiles
          ? {
              id: 'recentFiles',
              node: <RecentResource />,
              span: 'wide',
            }
          : null,
        {
          id: 'examples',
          node: <SuggestQuestions mode={contentMode} />,
          span: 'wide',
        },
        {
          id: 'skills',
          node: <FeaturedPlugins />,
          span: 'wide',
        },
        {
          id: 'community',
          node: <CommunityRecommend mode={contentMode} />,
          span: 'full',
        },
      ].filter(Boolean) as HomePanelDefinition[],
    [contentMode, showRecentDocs, showRecentFiles],
  );

  const availablePanelIds = useMemo(() => panels.map((panel) => panel.id), [panels]);
  const panelMap = useMemo(
    () => new Map<HomePanelId, HomePanelDefinition>(panels.map((panel) => [panel.id, panel])),
    [panels],
  );
  const [panelOrder, setPanelOrder] = useState<HomePanelId[]>(() =>
    normalizePanelOrder(DEFAULT_PANEL_ORDER),
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let parsed: unknown;
    const saved = window.localStorage.getItem(HOME_PANEL_ORDER_STORAGE_KEY);

    if (saved) {
      try {
        parsed = JSON.parse(saved);
      } catch {
        parsed = undefined;
      }
    }

    setPanelOrder(normalizePanelOrder(availablePanelIds, parsed));
  }, [availablePanelIds]);

  useEffect(() => {
    if (typeof window === 'undefined' || panelOrder.length === 0) return;

    window.localStorage.setItem(HOME_PANEL_ORDER_STORAGE_KEY, JSON.stringify(panelOrder));
  }, [panelOrder]);

  const orderedPanels = useMemo(
    () => panelOrder.map((id) => panelMap.get(id)).filter(Boolean) as HomePanelDefinition[],
    [panelMap, panelOrder],
  );

  const onDragEnd = useCallback(({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    setPanelOrder((current) => {
      const next = [...current];
      const from = next.indexOf(active.id as HomePanelId);
      const to = next.indexOf(over.id as HomePanelId);

      if (from === -1 || to === -1) return current;

      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      return next;
    });
  }, []);

  return (
    <Flexbox className={styles.workspaceRoot} gap={WORKSPACE_HOME_SECTION_GAP_PX} width={'100%'}>
      <Block className={styles.heroCard}>
        <div className={styles.heroSection}>
          <div className={styles.heroLead}>
            <Text as={'div'} className={styles.heroTitle}>
              {t('workspace.hero.title')}
            </Text>
            <Text as={'div'} className={styles.heroDescription}>
              {t('workspace.hero.subtitle')}
            </Text>
          </div>
          <InputArea />
        </div>
      </Block>

      <div className={styles.sectionHeader}>
        <div className={styles.sectionLabel}>
          <LayoutGrid size={13} strokeWidth={2} />
          <Text as={'span'}>
            {t('workspace.arrange.title', { defaultValue: 'Arrange sections' })}
          </Text>
        </div>
        <div className={styles.sectionRule} />
      </div>

      <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={onDragEnd}>
        <div className={styles.contentGrid}>
          {orderedPanels.map((panel) => (
            <DraggableHomePanel id={panel.id} key={panel.id} span={panel.span}>
              {panel.node}
            </DraggableHomePanel>
          ))}
        </div>
      </DndContext>
    </Flexbox>
  );
});

export default Home;
