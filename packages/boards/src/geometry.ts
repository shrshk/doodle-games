import type { Grid } from "./schema";

export interface Cell {
  /** 0 is the top row */
  row: number;
  col: number;
}

export function squareCount(grid: Pick<Grid, "rows" | "cols">): number {
  return grid.rows * grid.cols;
}

/** Grid cell for square 1..rows*cols. */
export function squareToCell(grid: Grid, square: number): Cell {
  const total = squareCount(grid);
  if (!Number.isInteger(square) || square < 1 || square > total) {
    throw new RangeError(`square ${square} is outside 1..${total}`);
  }
  switch (grid.layout) {
    case "boustrophedon": {
      const i = square - 1;
      const fromBottom = Math.floor(i / grid.cols);
      const along = i % grid.cols;
      const leftToRight = (fromBottom % 2 === 0) === (grid.origin === "bottom-left");
      return { row: grid.rows - 1 - fromBottom, col: leftToRight ? along : grid.cols - 1 - along };
    }
    case "custom": {
      const cell = grid.customOrder?.[square - 1];
      if (!cell) throw new Error(`custom layout has no cell for square ${square}`);
      return { row: cell[0], col: cell[1] };
    }
    case "spiral": {
      const cell = spiralOrder(grid)[square - 1];
      if (!cell) throw new Error(`spiral has no cell for square ${square}`);
      return cell;
    }
  }
}

const spiralCache = new Map<string, Cell[]>();

/**
 * Cells in path order for a spiral board: start in a bottom corner, run along the edge and wind
 * inward, finishing in the middle. From bottom-left the path turns anticlockwise on screen
 * (right, up, left, down); from bottom-right it mirrors.
 */
export function spiralOrder(grid: Pick<Grid, "rows" | "cols" | "origin">): Cell[] {
  const key = `${grid.rows}x${grid.cols}:${grid.origin}`;
  const cached = spiralCache.get(key);
  if (cached) return cached;

  const order: Cell[] = [];
  let top = 0;
  let bottom = grid.rows - 1;
  let left = 0;
  let right = grid.cols - 1;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) order.push({ row: bottom, col: c });
    for (let r = bottom - 1; r >= top; r--) order.push({ row: r, col: right });
    if (top < bottom) for (let c = right - 1; c >= left; c--) order.push({ row: top, col: c });
    if (left < right) for (let r = top + 1; r <= bottom - 1; r++) order.push({ row: r, col: left });
    top++;
    bottom--;
    left++;
    right--;
  }
  const mirrored =
    grid.origin === "bottom-right" ? order.map(({ row, col }) => ({ row, col: grid.cols - 1 - col })) : order;
  spiralCache.set(key, mirrored);
  return mirrored;
}
