export type SymbolKey = string;

export interface CellPosition {
  row: number;
  col: number;
}

export const MATH_VERSION = 'strips-v4';

export const REEL_STRIPS: SymbolKey[][] = [
  [
    'red-cherry', 'raspberry', 'strawberry', 'red-cherry',
    'black-cherry', 'raspberry', 'red-cherry', 'black-berry-dark',
    'raspberry', 'red-cherry', 'black-berry-light', 'black-berry-light',
    'black-berry-light', 'raspberry', 'black-cherry', 'red-cherry',
    'black-berry-dark', 'raspberry', 'red-cherry', 'black-berry-light',
    'raspberry', 'red-cherry', 'black-cherry', 'raspberry',
  ],
  [
    'raspberry', 'red-cherry', 'black-berry-dark', 'raspberry',
    'strawberry', 'red-cherry', 'raspberry', 'black-cherry',
    'red-cherry', 'raspberry', 'black-berry-light', 'red-cherry',
    'raspberry', 'black-cherry', 'red-cherry', 'raspberry',
    'black-berry-dark', 'strawberry', 'raspberry', 'red-cherry',
    'black-berry-light', 'raspberry', 'red-cherry', 'raspberry',
  ],
  [
    'black-cherry', 'red-cherry', 'raspberry', 'black-berry-light',
    'red-cherry', 'raspberry', 'strawberry', 'red-cherry',
    'black-berry-dark', 'raspberry', 'red-cherry', 'black-cherry',
    'raspberry', 'red-cherry', 'black-berry-light', 'raspberry',
    'red-cherry', 'strawberry', 'black-cherry', 'raspberry',
    'red-cherry', 'black-berry-dark', 'raspberry', 'red-cherry',
  ],
  [
    'raspberry', 'black-cherry', 'red-cherry', 'raspberry',
    'black-berry-dark', 'red-cherry', 'raspberry', 'strawberry',
    'black-berry-dark', 'black-berry-dark', 'black-berry-dark', 'red-cherry',
    'black-cherry', 'raspberry', 'red-cherry', 'black-berry-dark',
    'raspberry', 'red-cherry', 'strawberry', 'raspberry',
    'black-cherry', 'red-cherry', 'raspberry', 'black-berry-light',
  ],
];

export const PAYLINES: number[][] = [
  [0, 0, 0, 0],
  [1, 1, 1, 1],
  [2, 2, 2, 2],
];

export const PAYTABLE: Record<string, Partial<Record<3 | 4, number>>> = {
  strawberry: { 3: 5, 4: 20 },
  'red-cherry': { 3: 3, 4: 10 },
  raspberry: { 3: 2, 4: 8 },
  'black-cherry': { 3: 3, 4: 10 },
  'black-berry-dark': { 3: 2, 4: 6 },
  'black-berry-light': { 3: 2, 4: 6 },
};

function mod(value: number, length: number): number {
  return ((value % length) + length) % length;
}

export function columnFromStop(strip: SymbolKey[], stopIndex: number, rows = 3): SymbolKey[] {
  return Array.from({ length: rows }, (_, row) => strip[mod(stopIndex + row, strip.length)]);
}

export function matrixFromStops(stops: number[]): SymbolKey[][] {
  const rows = 3;
  const matrix: SymbolKey[][] = [[], [], []];
  for (let col = 0; col < REEL_STRIPS.length; col += 1) {
    const column = columnFromStop(REEL_STRIPS[col], stops[col] ?? 0, rows);
    for (let row = 0; row < rows; row += 1) {
      matrix[row][col] = column[row];
    }
  }
  return matrix;
}

export function evaluateWin(matrix: SymbolKey[][], bet: number): {
  winAmount: number;
  winningCells: CellPosition[];
  lines: CellPosition[][];
} {
  let winAmount = 0;
  const winning = new Map<string, CellPosition>();
  const lines: CellPosition[][] = [];

  const addRun = (symbol: SymbolKey, cells: CellPosition[], count: 3 | 4): void => {
    const multiplier = PAYTABLE[symbol]?.[count] ?? 0;
    if (multiplier <= 0) {
      return;
    }
    winAmount += bet * multiplier;
    for (const cell of cells) {
      winning.set(`${cell.row},${cell.col}`, cell);
    }
    lines.push(cells);
  };

  for (const line of PAYLINES) {
    const symbols = line.map((row, col) => matrix[row][col]);
    let leftCount = 1;
    while (leftCount < symbols.length && symbols[leftCount] === symbols[0]) {
      leftCount += 1;
    }

    let rightCount = 1;
    const last = symbols.length - 1;
    while (rightCount <= last && symbols[last - rightCount] === symbols[last]) {
      rightCount += 1;
    }

    if (leftCount >= 3) {
      addRun(
        symbols[0],
        Array.from({ length: leftCount }, (_, col) => ({ row: line[col], col })),
        leftCount as 3 | 4,
      );
    }

    const rightRepeatsLeft = symbols[0] === symbols[last] && leftCount === symbols.length;
    if (rightCount >= 3 && !rightRepeatsLeft) {
      const startCol = symbols.length - rightCount;
      addRun(
        symbols[last],
        Array.from({ length: rightCount }, (_, offset) => ({ row: line[startCol + offset], col: startCol + offset })),
        rightCount as 3 | 4,
      );
    }
  }

  for (let col = 0; col < matrix[0].length; col += 1) {
    const symbol = matrix[0][col];
    if (!symbol || matrix[1][col] !== symbol || matrix[2][col] !== symbol) {
      continue;
    }

    const multiplier = PAYTABLE[symbol]?.[3] ?? 0;
    if (multiplier <= 0) {
      continue;
    }

    winAmount += bet * multiplier;
    const cells = [0, 1, 2].map((row) => ({ row, col }));
    for (const cell of cells) {
      winning.set(`${cell.row},${cell.col}`, cell);
    }
    lines.push(cells);
  }

  return { winAmount, winningCells: [...winning.values()], lines };
}

export function randomStops(): number[] {
  const bytes = new Uint32Array(REEL_STRIPS.length);
  crypto.getRandomValues(bytes);
  return REEL_STRIPS.map((strip, index) => bytes[index] % strip.length);
}
