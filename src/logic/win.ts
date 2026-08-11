import { REEL_COUNT, ResultMatrix, SymbolKey, WinLine } from '../config/types';

const ROW_COUNT = 3;
const HORIZONTAL_WIN_LENGTH = 3;

function randomSymbol(symbols: SymbolKey[]): SymbolKey {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
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
      const symbolIndex =
        (row + column + Math.floor(Math.random() * symbols.length)) % symbols.length;
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
  const matrix = generateLosingMatrix(symbols);
  const symbol = randomSymbol(symbols);
  const isHorizontal = Math.random() < 0.5;

  if (isHorizontal) {
    const row = randomInt(ROW_COUNT);
    const startCol = randomInt(REEL_COUNT - HORIZONTAL_WIN_LENGTH + 1);

    for (let offset = 0; offset < HORIZONTAL_WIN_LENGTH; offset += 1) {
      matrix[row][startCol + offset] = symbol;
    }

    return {
      matrix,
      winLine: {
        symbol,
        cells: Array.from({ length: HORIZONTAL_WIN_LENGTH }, (_, offset) => ({ row, col: startCol + offset })),
      },
    };
  }

  const col = randomInt(REEL_COUNT);

  for (let row = 0; row < ROW_COUNT; row += 1) {
    matrix[row][col] = symbol;
  }

  return {
    matrix,
    winLine: {
      symbol,
      cells: Array.from({ length: ROW_COUNT }, (_, row) => ({ row, col })),
    },
  };
}
