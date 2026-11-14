export interface MazeCell {
  col: number;
  row: number;
}

export interface MazeTrap {
  id: string;
  kind: 'saw' | 'laser';
  x: number; // world px
  y: number; // world px
  baseX: number;
  baseY: number;
  axis: 'x' | 'y';
  range: number; // patrol distance in px
  speed: number;
  phase: number;
  radius: number;
}

export interface MazeCoin {
  id: string;
  x: number;
  y: number;
  col: number;
  row: number;
  collected: boolean;
  bonus?: boolean;
}

export interface MazeGateWall {
  col: number;
  row: number;
  open: boolean;
}

export interface MazeData {
  cols: number;
  rows: number;
  cellSize: number;
  grid: number[][]; // 1 = wall, 0 = open path
  start: MazeCell;
  exit: MazeCell;
  distMap: number[][]; // BFS step distance to exit
  maxDist: number;
  coins: MazeCoin[];
  traps: MazeTrap[];
  dynamicWalls: MazeGateWall[];
  lanterns: { x: number; y: number; color: string }[];
}

export function createSeededRandom(seed: number): () => number {
  let s = seed % 233280;
  if (s <= 0) s += 233280;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function computeDistanceMap(
  grid: number[][],
  exit: MazeCell
): { distMap: number[][]; maxDist: number } {
  const rows = grid.length;
  const cols = grid[0].length;
  const distMap: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(Infinity)
  );

  const queue: MazeCell[] = [{ col: exit.col, row: exit.row }];
  distMap[exit.row][exit.col] = 0;

  let head = 0;
  let maxDist = 1;
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (head < queue.length) {
    const cur = queue[head++];
    const curDist = distMap[cur.row][cur.col];
    for (const [dc, dr] of dirs) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (
        nr >= 0 &&
        nr < rows &&
        nc >= 0 &&
        nc < cols &&
        grid[nr][nc] === 0 &&
        distMap[nr][nc] === Infinity
      ) {
        distMap[nr][nc] = curDist + 1;
        if (curDist + 1 > maxDist) maxDist = curDist + 1;
        queue.push({ col: nc, row: nr });
      }
    }
  }

  return { distMap, maxDist };
}

export function findNextStepToward(
  grid: number[][],
  from: MazeCell,
  target: MazeCell
): MazeCell {
  const rows = grid.length;
  const cols = grid[0].length;
  if (from.col === target.col && from.row === target.row) return from;

  const visited: boolean[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(false)
  );
  const parent: (MazeCell | null)[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(null)
  );

  const queue: MazeCell[] = [from];
  visited[from.row][from.col] = true;
  let head = 0;
  let found = false;

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  while (head < queue.length) {
    const cur = queue[head++];
    if (cur.col === target.col && cur.row === target.row) {
      found = true;
      break;
    }
    for (const [dc, dr] of dirs) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (
        nr >= 0 &&
        nr < rows &&
        nc >= 0 &&
        nc < cols &&
        !visited[nr][nc] &&
        grid[nr][nc] === 0
      ) {
        visited[nr][nc] = true;
        parent[nr][nc] = cur;
        queue.push({ col: nc, row: nr });
      }
    }
  }

  if (!found) return from;

  let step: MazeCell = target;
  while (true) {
    const p = parent[step.row][step.col];
    if (!p) break;
    if (p.col === from.col && p.row === from.row) {
      return step;
    }
    step = p;
  }
  return from;
}

export function generateMaze(
  seed: number,
  options?: { cols?: number; rows?: number; cellSize?: number; level?: number }
): MazeData {
  const cols = options?.cols ?? 21;
  const rows = options?.rows ?? 21;
  const cellSize = options?.cellSize ?? 58;
  const level = options?.level ?? 1;
  const rand = createSeededRandom(seed + level * 7919);

  // Initialize solid wall grid
  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(1)
  );

  const start: MazeCell = { col: 1, row: 1 };
  const exit: MazeCell = { col: cols - 2, row: rows - 2 };

  // Randomized Iterative Backtracker
  const stack: MazeCell[] = [start];
  grid[start.row][start.col] = 0;

  const carveDirs = [
    [0, -2],
    [2, 0],
    [0, 2],
    [-2, 0],
  ];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];
    const neighbors: { cell: MazeCell; wall: MazeCell }[] = [];

    for (const [dc, dr] of carveDirs) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (nr > 0 && nr < rows - 1 && nc > 0 && nc < cols - 1 && grid[nr][nc] === 1) {
        neighbors.push({
          cell: { col: nc, row: nr },
          wall: { col: cur.col + dc / 2, row: cur.row + dr / 2 },
        });
      }
    }

    if (neighbors.length > 0) {
      const chosen = neighbors[Math.floor(rand() * neighbors.length)];
      grid[chosen.wall.row][chosen.wall.col] = 0;
      grid[chosen.cell.row][chosen.cell.col] = 0;
      stack.push(chosen.cell);
    } else {
      stack.pop();
    }
  }

  // Braid ~22% of dead ends / interior walls so players have loops & overtaking lanes
  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      if (grid[r][c] === 1) {
        const horizOpen = grid[r][c - 1] === 0 && grid[r][c + 1] === 0 && grid[r - 1][c] === 1 && grid[r + 1][c] === 1;
        const vertOpen = grid[r - 1][c] === 0 && grid[r + 1][c] === 0 && grid[r][c - 1] === 1 && grid[r][c + 1] === 1;
        if ((horizOpen || vertOpen) && rand() < 0.22) {
          grid[r][c] = 0;
        }
      }
    }
  }

  const { distMap, maxDist } = computeDistanceMap(grid, exit);

  // Collect open cells (excluding immediate start pad)
  const openCells: MazeCell[] = [];
  for (let r = 1; r < rows - 1; r++) {
    for (let c = 1; c < cols - 1; c++) {
      if (grid[r][c] === 0) {
        const manhattanStart = Math.abs(c - start.col) + Math.abs(r - start.row);
        const manhattanExit = Math.abs(c - exit.col) + Math.abs(r - exit.row);
        if (manhattanStart >= 2 && manhattanExit >= 1) {
          openCells.push({ col: c, row: r });
        }
      }
    }
  }

  // Place Golden Coins (extra reward in dead ends + along corridors)
  const coins: MazeCoin[] = [];
  const usedCoinCells = new Set<string>();

  for (const cell of openCells) {
    const { col, row } = cell;
    if (col === exit.col && row === exit.row) continue;

    let wallCount = 0;
    if (grid[row - 1][col] === 1) wallCount++;
    if (grid[row + 1][col] === 1) wallCount++;
    if (grid[row][col - 1] === 1) wallCount++;
    if (grid[row][col + 1] === 1) wallCount++;

    const isDeadEnd = wallCount >= 3;
    const chance = isDeadEnd ? 0.85 : 0.16;
    if (rand() < chance && coins.length < 44) {
      usedCoinCells.add(`${col},${row}`);
      coins.push({
        id: `coin-${col}-${row}`,
        col,
        row,
        x: (col + 0.5) * cellSize,
        y: (row + 0.5) * cellSize,
        collected: false,
        bonus: isDeadEnd,
      });
    }
  }

  // Place Carnival Traps (Spinning Sawblades & High-Voltage Laser Barriers)
  const traps: MazeTrap[] = [];
  const trapCount = Math.min(24, 12 + (level - 1) * 3);
  const shuffled = [...openCells].sort(() => rand() - 0.5);

  for (const cell of shuffled) {
    if (traps.length >= trapCount) break;
    const { col, row } = cell;
    const distFromStart = Math.abs(col - start.col) + Math.abs(row - start.row);
    const distFromExit = Math.abs(col - exit.col) + Math.abs(row - exit.row);
    if (distFromStart < 4 || distFromExit < 2) continue;

    // Avoid clustering traps too close together
    const cx = (col + 0.5) * cellSize;
    const cy = (row + 0.5) * cellSize;
    const tooClose = traps.some((t) => Math.hypot(t.baseX - cx, t.baseY - cy) < cellSize * 2.1);
    if (tooClose) continue;

    const canMoveX = grid[row][col - 1] === 0 || grid[row][col + 1] === 0;
    const canMoveY = grid[row - 1][col] === 0 || grid[row + 1][col] === 0;
    const axis: 'x' | 'y' = canMoveX && (!canMoveY || rand() < 0.5) ? 'x' : 'y';

    // Measure corridor extent along chosen axis
    let negSteps = 0;
    let posSteps = 0;
    if (axis === 'x') {
      if (grid[row][col - 1] === 0) negSteps = 1;
      if (grid[row][col + 1] === 0) posSteps = 1;
    } else {
      if (grid[row - 1][col] === 0) negSteps = 1;
      if (grid[row + 1][col] === 0) posSteps = 1;
    }

    const kind: 'saw' | 'laser' = traps.length % 3 === 1 ? 'laser' : 'saw';
    const range = kind === 'laser' ? 0 : Math.min(negSteps, posSteps) * cellSize * 0.65;

    traps.push({
      id: `trap-${col}-${row}`,
      kind,
      x: cx,
      y: cy,
      baseX: cx,
      baseY: cy,
      axis,
      range,
      speed: 1.8 + rand() * 1.4 + (level - 1) * 0.25,
      phase: rand() * Math.PI * 2,
      radius: kind === 'laser' ? cellSize * 0.34 : cellSize * 0.28,
    });
  }

  // Dynamic shifting walls for "THE MAZE IS SHIFTING!" events
  const dynamicWalls: MazeGateWall[] = [];
  for (let r = 2; r < rows - 2; r++) {
    for (let c = 2; c < cols - 2; c++) {
      if (grid[r][c] === 1 && rand() < 0.08 && dynamicWalls.length < 10) {
        dynamicWalls.push({ col: c, row: r, open: false });
      }
    }
  }

  // Carnival neon lanterns along intersections
  const lanterns: { x: number; y: number; color: string }[] = [];
  for (let r = 1; r < rows - 1; r += 2) {
    for (let c = 1; c < cols - 1; c += 2) {
      if (grid[r][c] === 0 && rand() < 0.35) {
        lanterns.push({
          x: (c + 0.5) * cellSize,
          y: (r + 0.5) * cellSize,
          color: (r + c) % 4 === 0 ? '#ff3ea5' : '#55eaff',
        });
      }
    }
  }

  return {
    cols,
    rows,
    cellSize,
    grid,
    start,
    exit,
    distMap,
    maxDist,
    coins,
    traps,
    dynamicWalls,
    lanterns,
  };
}
