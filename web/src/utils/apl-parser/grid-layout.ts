export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type GridLane = "root" | "block" | "action" | "expression";

export const LANE_WIDTH = 520;
export const ROW_HEIGHT = 120;
export const PROFILE_PADDING_ROWS = 2;
export const EXPRESSION_NODE_BOUNDS: Readonly<Size> = { width: 280, height: 48 };
const ACTION_NODE_BASE_WIDTH = 240;
const ACTION_TO_EXPRESSION_GAP_REDUCTION =
  (LANE_WIDTH - ACTION_NODE_BASE_WIDTH) * 0.35;

const LANE_X: Record<GridLane, number> = {
  root: 0,
  block: LANE_WIDTH,
  action: LANE_WIDTH * 2,
  expression: LANE_WIDTH * 3 - ACTION_TO_EXPRESSION_GAP_REDUCTION,
};

export function gridPoint(lane: GridLane, row: number, depth = 0): Point {
  return {
    x: LANE_X[lane] + depth * LANE_WIDTH,
    y: row * ROW_HEIGHT,
  };
}

export function rowsFromBounds(bounds: Size): number {
  return Math.max(1, Math.ceil(bounds.height / ROW_HEIGHT));
}
