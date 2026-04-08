import type { DiningTable } from "@/lib/types";

export type TableShape = "square" | "round";

export type GridCell = {
  row: number;
  col: number;
  shape: TableShape;
};

export type GridFloorState = {
  cols: number;
  rows: number;
  cells: Record<string, GridCell>;
};

export const GRID_FLOOR_STORAGE_KEY = "pos_floor_grid_v3";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function suggestDimensions(tableCount: number): { cols: number; rows: number } {
  const n = Math.max(1, tableCount);
  const packedCols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const packedRows = Math.max(1, Math.ceil(n / packedCols));
  // Layout base with one empty cell between tables: mesa, espacio, mesa...
  const cols = packedCols * 2 - 1;
  let rows = packedRows * 2 - 1;
  while (Math.ceil(cols / 2) * Math.ceil(rows / 2) < n) {
    rows += 2;
  }
  return { cols, rows };
}

export function defaultGridState(tables: DiningTable[]): GridFloorState {
  const n = tables.length;
  if (n === 0) return { cols: 1, rows: 1, cells: {} };
  const { cols, rows } = suggestDimensions(n);
  const tableCols = Math.ceil(cols / 2);
  const cells: Record<string, GridCell> = {};
  tables.forEach((t, i) => {
    const packedRow = Math.floor(i / tableCols);
    const packedCol = i % tableCols;
    cells[t.id] = {
      row: packedRow * 2,
      col: packedCol * 2,
      shape: "square",
    };
  });
  return { cols, rows, cells };
}

function cellKey(r: number, c: number) {
  return `${r},${c}`;
}

/** Resuelve solapes asignando la primera celda libre en orden fila→columna. */
function dedupeOccupancy(state: GridFloorState, tables: DiningTable[]): GridFloorState {
  const used = new Set<string>();
  const cells = { ...state.cells };
  const { cols, rows } = state;

  for (const t of tables) {
    let cell = cells[t.id];
    if (!cell) {
      cell = { row: 0, col: 0, shape: "square" };
    }
    cell = {
      row: clamp(cell.row, 0, rows - 1),
      col: clamp(cell.col, 0, cols - 1),
      shape: cell.shape === "round" ? "round" : "square",
    };
    let key = cellKey(cell.row, cell.col);
    if (used.has(key)) {
      let placed = false;
      for (let r = 0; r < rows && !placed; r++) {
        for (let c = 0; c < cols && !placed; c++) {
          const k = cellKey(r, c);
          if (!used.has(k)) {
            cell = { ...cell, row: r, col: c };
            placed = true;
          }
        }
      }
      if (!placed) {
        cell = { ...cell, row: 0, col: 0 };
        key = cellKey(cell.row, cell.col);
      }
    }
    used.add(cellKey(cell.row, cell.col));
    cells[t.id] = cell;
  }
  return { ...state, cells };
}

export function loadGridState(tables: DiningTable[]): GridFloorState {
  const fallback = defaultGridState(tables);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(GRID_FLOOR_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as GridFloorState;
    if (!parsed || typeof parsed.cols !== "number" || typeof parsed.rows !== "number" || !parsed.cells) {
      return fallback;
    }
    const n = tables.length;
    const minCols = suggestDimensions(n).cols;
    const minRows = suggestDimensions(n).rows;
    const cols = Math.max(minCols, parsed.cols, 1);
    let rows = Math.max(minRows, parsed.rows, 1);
    while (cols * rows < n) {
      rows += 1;
    }
    const cells: Record<string, GridCell> = {};
    for (const t of tables) {
      const saved = parsed.cells[t.id];
      if (saved) {
        cells[t.id] = {
          row: clamp(saved.row, 0, rows - 1),
          col: clamp(saved.col, 0, cols - 1),
          shape: saved.shape === "round" ? "round" : "square",
        };
      } else {
        cells[t.id] = fallback.cells[t.id] ?? {
          row: 0,
          col: 0,
          shape: "square",
        };
      }
    }
    return dedupeOccupancy({ cols, rows, cells }, tables);
  } catch {
    return fallback;
  }
}

export function saveGridState(state: GridFloorState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(GRID_FLOOR_STORAGE_KEY, JSON.stringify(state));
}

export function swapCells(
  state: GridFloorState,
  tableIdA: string,
  tableIdB: string,
): GridFloorState {
  const a = state.cells[tableIdA];
  const b = state.cells[tableIdB];
  if (!a || !b) return state;
  const cells = {
    ...state.cells,
    [tableIdA]: { ...a, row: b.row, col: b.col },
    [tableIdB]: { ...b, row: a.row, col: a.col },
  };
  return { ...state, cells };
}

export function moveTableToCell(
  state: GridFloorState,
  tableId: string,
  row: number,
  col: number,
  tables: DiningTable[],
): GridFloorState {
  const cell = state.cells[tableId];
  if (!cell) return state;
  row = clamp(row, 0, state.rows - 1);
  col = clamp(col, 0, state.cols - 1);
  const occupant = tables.find(
    (t) => t.id !== tableId && state.cells[t.id]?.row === row && state.cells[t.id]?.col === col,
  );
  // If target cell is occupied, keep original position (no swap).
  if (occupant) return state;
  return {
    ...state,
    cells: {
      ...state.cells,
      [tableId]: { ...cell, row, col },
    },
  };
}

export function toggleShape(state: GridFloorState, tableId: string): GridFloorState {
  const cell = state.cells[tableId];
  if (!cell) return state;
  const nextShape: TableShape = cell.shape === "round" ? "square" : "round";
  return {
    ...state,
    cells: {
      ...state.cells,
      [tableId]: { ...cell, shape: nextShape },
    },
  };
}
