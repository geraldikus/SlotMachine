export type SymbolKey = string;
export type ResultMatrix = SymbolKey[][];
export type CellPosition = { row: number; col: number };
export interface WinLine {
  cells: CellPosition[];
  symbol: SymbolKey;
}

const REEL_COUNT = 4;
const ROW_COUNT = 3;
const HORIZONTAL_WIN_LENGTH = 3;

function randomSymbol(symbols: SymbolKey[]): SymbolKey {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function pickSymbolExcept(symbols: SymbolKey[], exclude: SymbolKey): SymbolKey {
  const alternative = symbols.find((symbol) => symbol !== exclude);
  return alternative ?? exclude;
}

function isVerticalWinLine(winLine: WinLine, col: number): boolean {
  return winLine.cells.length === ROW_COUNT && winLine.cells.every((cell) => cell.col === col);
}

function breakHorizontalWinsOnRow(
  matrix: ResultMatrix,
  symbols: SymbolKey[],
  row: number,
  symbol: SymbolKey,
  preserveCol?: number,
): void {
  for (let start = 0; start <= REEL_COUNT - HORIZONTAL_WIN_LENGTH; start += 1) {
    const isWin = Array.from({ length: HORIZONTAL_WIN_LENGTH }, (_, offset) => matrix[row][start + offset]).every(
      (cell) => cell === symbol,
    );

    if (!isWin) {
      continue;
    }

    for (let offset = 0; offset < HORIZONTAL_WIN_LENGTH; offset += 1) {
      const col = start + offset;
      if (preserveCol !== undefined && col === preserveCol) {
        continue;
      }

      matrix[row][col] = pickSymbolExcept(symbols, symbol);
      break;
    }
  }
}

function tryBuildWinningMatrix(symbols: SymbolKey[]): { matrix: ResultMatrix; winLine: WinLine } | null {
  const matrix = generateLosingMatrix(symbols);
  const symbol = randomSymbol(symbols);
  const isHorizontal = Math.random() < 0.5;

  if (isHorizontal) {
    const row = randomInt(ROW_COUNT);
    const startCol = randomInt(REEL_COUNT - HORIZONTAL_WIN_LENGTH + 1);

    for (let offset = 0; offset < HORIZONTAL_WIN_LENGTH; offset += 1) {
      matrix[row][startCol + offset] = symbol;
    }

    if (startCol > 0) {
      matrix[row][startCol - 1] = pickSymbolExcept(symbols, symbol);
    } else {
      matrix[row][REEL_COUNT - 1] = pickSymbolExcept(symbols, symbol);
    }

    const winLine = findWinLine(matrix);
    if (!winLine || winLine.symbol !== symbol) {
      return null;
    }

    const expectedCols = Array.from({ length: HORIZONTAL_WIN_LENGTH }, (_, offset) => startCol + offset);
    const detectedCols = winLine.cells.map((cell) => cell.col).sort();
    if (detectedCols.join(',') !== expectedCols.sort().join(',')) {
      return null;
    }

    return { matrix, winLine };
  }

  const col = randomInt(REEL_COUNT);

  for (let row = 0; row < ROW_COUNT; row += 1) {
    matrix[row][col] = symbol;
  }

  for (let row = 0; row < ROW_COUNT; row += 1) {
    breakHorizontalWinsOnRow(matrix, symbols, row, symbol, col);
  }

  const winLine = findWinLine(matrix);
  if (!winLine || !isVerticalWinLine(winLine, col) || winLine.symbol !== symbol) {
    return null;
  }

  return { matrix, winLine };
}

export function findWinLine(matrix: ResultMatrix): WinLine | null {
  for (let row = 0; row < ROW_COUNT; row += 1) {
    for (let col = 0; col <= REEL_COUNT - HORIZONTAL_WIN_LENGTH; col += 1) {
      const symbol = matrix[row][col];
      const isWin = Array.from({ length: HORIZONTAL_WIN_LENGTH }, (_, offset) => matrix[row][col + offset]).every(
        (cell) => cell === symbol,
      );

      if (isWin) {
        return {
          symbol,
          cells: Array.from({ length: HORIZONTAL_WIN_LENGTH }, (_, offset) => ({ row, col: col + offset })),
        };
      }
    }
  }

  for (let col = 0; col < REEL_COUNT; col += 1) {
    const symbol = matrix[0][col];
    const isWin = matrix.every((row) => row[col] === symbol);

    if (isWin) {
      return {
        symbol,
        cells: Array.from({ length: ROW_COUNT }, (_, row) => ({ row, col })),
      };
    }
  }

  return null;
}

function generateRandomMatrix(symbols: SymbolKey[]): ResultMatrix {
  const rows: ResultMatrix = [];

  for (let row = 0; row < ROW_COUNT; row += 1) {
    const line: SymbolKey[] = [];
    for (let column = 0; column < REEL_COUNT; column += 1) {
      const symbolIndex = (row + column + Math.floor(Math.random() * symbols.length)) % symbols.length;
      line.push(symbols[symbolIndex]);
    }
    rows.push(line);
  }

  return rows;
}

function buildGuaranteedLosingMatrix(symbols: SymbolKey[]): ResultMatrix {
  const rows: ResultMatrix = [];

  for (let row = 0; row < ROW_COUNT; row += 1) {
    const line: SymbolKey[] = [];
    for (let column = 0; column < REEL_COUNT; column += 1) {
      line.push(symbols[(row + column) % symbols.length]);
    }
    rows.push(line);
  }

  return rows;
}

export function generateLosingMatrix(symbols: SymbolKey[]): ResultMatrix {
  const maxAttempts = 50;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const matrix = generateRandomMatrix(symbols);
    if (!findWinLine(matrix)) {
      return matrix;
    }
  }

  return buildGuaranteedLosingMatrix(symbols);
}

export function generateWinningMatrix(symbols: SymbolKey[]): { matrix: ResultMatrix; winLine: WinLine } {
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = tryBuildWinningMatrix(symbols);
    if (result) {
      return result;
    }
  }

  const matrix = generateLosingMatrix(symbols);
  const symbol = symbols[0];
  matrix[0][0] = symbol;
  matrix[0][1] = symbol;
  matrix[0][2] = symbol;
  matrix[0][REEL_COUNT - 1] = pickSymbolExcept(symbols, symbol);

  const winLine = findWinLine(matrix);
  if (!winLine) {
    throw new Error('Failed to generate winning matrix');
  }

  return { matrix, winLine };
}
