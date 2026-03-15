import { createStaticStyles } from 'antd-style';

const editorPanelHeight = 'clamp(760px, calc(100vh - 180px), 1120px)';

export const styles = createStaticStyles(({ css, cssVar }) => ({
  actions: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${cssVar.marginSM};
    align-items: center;
  `,
  bindingArrow: css`
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${cssVar.colorTextDescription};

    @media (width <= 640px) {
      display: none;
    }
  `,
  bindingRow: css`
    display: grid;
    grid-template-columns: minmax(0, 168px) 24px minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;

    @media (width <= 640px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  canvasStage: css`
    position: relative;

    overflow: hidden;

    height: ${editorPanelHeight};
    min-height: 760px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: calc(${cssVar.borderRadiusLG} * 1.25);

    background:
      radial-gradient(circle at top left, ${cssVar.colorPrimaryBg} 0, transparent 26%),
      radial-gradient(circle at right center, ${cssVar.colorFillSecondary} 0, transparent 24%),
      ${cssVar.colorBgContainer};

    &::before {
      pointer-events: none;
      content: '';

      position: absolute;
      inset: 0;

      opacity: 0.18;
      background-image:
        linear-gradient(${cssVar.colorBorderSecondary} 1px, transparent 1px),
        linear-gradient(90deg, ${cssVar.colorBorderSecondary} 1px, transparent 1px);
      background-size: 28px 28px;
    }

    @media (width <= 900px) {
      height: 620px;
      min-height: 620px;
    }
  `,
  chatRole: css`
    min-width: 76px;

    font-family: ${cssVar.fontFamilyCode};
    font-size: ${cssVar.fontSizeSM};
    color: ${cssVar.colorTextSecondary};
    text-transform: uppercase;
    letter-spacing: 0.08em;
  `,
  chatRow: css`
    display: flex;
    gap: 12px;
    align-items: flex-start;
  `,
  connectionItem: css`
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: space-between;

    padding-block: 8px;
    padding-inline: 10px;
    border: 1px dashed ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorFillQuaternary};
  `,
  edgeLayer: css`
    pointer-events: auto;

    position: absolute;
    inset: 0;

    overflow: visible;

    width: 100%;
    height: 100%;
  `,
  edgeHitArea: css`
    pointer-events: stroke;
    cursor: pointer;

    fill: none;
    stroke: transparent;
    stroke-width: 18;
  `,
  edgePath: css`
    opacity: 0.88;
    filter: drop-shadow(0 0 10px ${cssVar.colorPrimaryBg});

    fill: none;
    stroke: ${cssVar.colorPrimaryBorder};
    stroke-dasharray: 9 6;
    stroke-linecap: round;
    stroke-width: 2.5;
  `,
  edgePathSelected: css`
    opacity: 1;
    stroke: ${cssVar.colorPrimary};
    stroke-width: 3;
  `,
  edgePathDraft: css`
    pointer-events: none;

    opacity: 0.92;

    fill: none;
    stroke: ${cssVar.colorPrimary};
    stroke-dasharray: 6 6;
    stroke-linecap: round;
    stroke-width: 3;
  `,
  node: css`
    cursor: grab;

    position: relative;

    overflow: visible;
    display: flex;
    flex-direction: column;
    gap: 12px;

    height: 100%;
    padding-block: 14px;
    padding-inline: 16px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: calc(${cssVar.borderRadiusLG} * 1.1);

    background: linear-gradient(180deg, ${cssVar.colorBgElevated}, ${cssVar.colorBgContainer});
    box-shadow: 0 10px 30px ${cssVar.colorFillTertiary};

    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.2s ease;

    &:hover {
      transform: translateY(-2px);
      border-color: ${cssVar.colorPrimaryBorder};
    }

    &:active {
      cursor: grabbing;
    }
  `,
  nodeBadgeRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${cssVar.marginXS};
  `,
  nodeEditing: css`
    cursor: text;
    border-color: ${cssVar.colorPrimaryBorder};
    box-shadow: 0 0 0 2px ${cssVar.colorPrimaryBorderHover};
  `,
  nodeConnectable: css`
    border-color: ${cssVar.colorPrimaryBorder};
    box-shadow:
      0 0 0 1px ${cssVar.colorPrimaryBorderHover},
      0 12px 30px ${cssVar.colorFillTertiary};
  `,
  nodePort: css`
    cursor: pointer;

    position: relative;
    z-index: 2;

    width: 16px;
    height: 16px;
    border: 2px solid ${cssVar.colorBgContainer};
    border-radius: 999px;

    background: ${cssVar.colorPrimary};
    box-shadow: 0 0 0 5px ${cssVar.colorPrimaryBg};

    transition:
      transform 0.2s ease,
      box-shadow 0.2s ease,
      background 0.2s ease;
  `,
  nodePortActive: css`
    background: ${cssVar.colorSuccess};
    box-shadow: 0 0 0 6px ${cssVar.colorSuccessBg};
  `,
  nodePortConnectable: css`
    background: ${cssVar.colorPrimary};
    box-shadow: 0 0 0 8px ${cssVar.colorPrimaryBg};
  `,
  nodePortInput: css`
    margin-inline-end: 8px;
  `,
  nodePortOutput: css`
    margin-inline-start: 8px;
  `,
  nodePortTarget: css`
    transform: scale(1.12);
    background: ${cssVar.colorSuccess};
    box-shadow: 0 0 0 9px ${cssVar.colorSuccessBg};
  `,
  nodeSelected: css`
    border-color: ${cssVar.colorPrimaryBorder};
    box-shadow:
      0 0 0 2px ${cssVar.colorPrimaryBorderHover},
      0 18px 40px ${cssVar.colorFill};
  `,
  nodeShell: css`
    position: absolute !important;
  `,
  nodePortWrap: css`
    position: absolute;
    z-index: 2;
    transform: translateY(-50%);

    display: flex;
    align-items: center;
  `,
  nodePortWrapInput: css`
    inset-inline-start: -10px;
    justify-content: flex-start;
  `,
  nodePortWrapOutput: css`
    inset-inline-end: -10px;
    justify-content: flex-end;
  `,
  nodeText: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 8;

    line-height: 1.65;
    color: ${cssVar.colorText};
    overflow-wrap: anywhere;
  `,
  nodeTitleRow: css`
    justify-content: space-between;
  `,
  nodeTitleInput: css`
    max-width: 140px;
  `,
  palette: css`
    position: absolute;
    z-index: 10;

    min-width: 220px;
    padding: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgElevated};
    box-shadow: 0 20px 60px ${cssVar.colorFill};
  `,
  resultBody: css`
    overflow: auto;

    min-width: 0;
    max-height: 280px;
    padding: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgElevated};

    & :where(.ant-typography, p, code, pre) {
      word-break: break-word;
      overflow-wrap: anywhere;
    }
  `,
  runtimePreview: css`
    min-width: 0;
    padding: ${cssVar.paddingMD};
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgElevated};
  `,
  scrollPanel: css`
    overflow: auto;
    height: ${editorPanelHeight};
    min-height: 760px;

    @media (width <= 1100px) {
      height: auto;
      min-height: unset;
      max-height: 420px;
    }
  `,
  previewRail: css`
    min-width: 0;
  `,
  sidebar: css`
    overflow: auto;
    display: grid;
    gap: 16px;
    align-content: start;

    min-width: 0;
    height: ${editorPanelHeight};
    min-height: 760px;

    @media (width <= 1100px) {
      overflow: visible;
      height: auto;
      min-height: unset;
    }
  `,
  sidebarCard: css`
    overflow: hidden;

    min-width: 0;
    padding: ${cssVar.paddingLG};
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgContainer};

    & :where(.ant-typography) {
      overflow-wrap: anywhere;
    }
  `,
  stageHint: css`
    position: absolute;
    z-index: 1;
    inset-block-end: 16px;
    inset-inline-end: 16px;

    padding-block: 8px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: 999px;

    background: ${cssVar.colorBgElevated};
  `,
  toolbar: css`
    padding-block: 12px;
    padding-inline: 14px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorBgContainer};
  `,
  toolbarGroup: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${cssVar.marginSM};
    align-items: center;
  `,
  toolButton: css`
    border-color: ${cssVar.colorText};
    color: ${cssVar.colorBgContainer};
    background: ${cssVar.colorText};

    &:hover,
    &:focus {
      border-color: ${cssVar.colorTextSecondary};
      color: ${cssVar.colorBgContainer};
      background: ${cssVar.colorTextSecondary};
    }
  `,
  toolbarSpacer: css`
    flex: 1;
  `,
  wireRoute: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${cssVar.marginXS};
    align-items: center;
  `,
  variableButtons: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${cssVar.marginXS};

    & > button {
      max-width: 100%;
      height: auto;
      text-align: start;
      white-space: normal;
    }
  `,
  variablePanel: css`
    display: grid;
    gap: ${cssVar.marginXS};

    padding: ${cssVar.paddingSM};
    border: 1px dashed ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadiusLG};

    background: ${cssVar.colorFillQuaternary};
  `,
  workspace: css`
    min-width: 0;
  `,
  workspaceBody: css`
    display: grid;
    grid-template-columns: 320px minmax(0, 1fr) 380px;
    gap: 16px;
    align-items: stretch;

    @media (width <= 1680px) {
      grid-template-columns: 300px minmax(0, 1fr) 340px;
    }

    @media (width <= 1280px) {
      grid-template-columns: minmax(0, 1fr) 340px;
    }

    @media (width <= 1100px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,
  canvasWrap: css`
    min-width: 0;
    min-height: 0;
  `,
  codeBlock: css`
    margin: 0;

    font-family: ${cssVar.fontFamilyCode};
    font-size: ${cssVar.fontSizeSM};
    line-height: 1.7;
    word-break: break-word;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  `,
}));
