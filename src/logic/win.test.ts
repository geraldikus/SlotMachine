import { SYMBOLS } from '../config/symbols';
import { ResultMatrix } from '../config/types';
import { findWinLine, generateLosingMatrix, generateWinningMatrix } from './win';

const TEST_SYMBOLS = ['a', 'b', 'c', 'd', 'e', 'f'];

describe('findWinLine', () => {
  describe('horizontal wins', () => {
    it('finds top row win at start', () => {
      const matrix: ResultMatrix = [
        ['strawberry', 'strawberry', 'strawberry', 'raspberry'],
        ['red-cherry', 'black-cherry', 'raspberry', 'strawberry'],
        ['black-berry-dark', 'red-cherry', 'black-cherry', 'raspberry'],
      ];
      expect(findWinLine(matrix)).toEqual({
        symbol: 'strawberry',
        cells: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
        ],
      });
    });

    it('finds top row win with offset', () => {
      const matrix: ResultMatrix = [
        ['red-cherry', 'raspberry', 'raspberry', 'raspberry'],
        ['a', 'b', 'c', 'd'],
        ['a', 'b', 'c', 'd'],
      ];
      expect(findWinLine(matrix)).toEqual({
        symbol: 'raspberry',
        cells: [
          { row: 0, col: 1 },
          { row: 0, col: 2 },
          { row: 0, col: 3 },
        ],
      });
    });

    it('finds middle row win', () => {
      const matrix: ResultMatrix = [
        ['a', 'b', 'c', 'd'],
        ['x', 'x', 'x', 'y'],
        ['a', 'b', 'c', 'd'],
      ];
      expect(findWinLine(matrix)?.cells.every((c) => c.row === 1)).toBe(true);
      expect(findWinLine(matrix)?.symbol).toBe('x');
    });

    it('finds bottom row win', () => {
      const matrix: ResultMatrix = [
        ['a', 'b', 'c', 'd'],
        ['a', 'b', 'c', 'd'],
        ['z', 'z', 'z', 'q'],
      ];
      const result = findWinLine(matrix);
      expect(result?.symbol).toBe('z');
      expect(result?.cells).toEqual([
        { row: 2, col: 0 },
        { row: 2, col: 1 },
        { row: 2, col: 2 },
      ]);
    });
  });

  describe('vertical wins', () => {
    it('finds first column win', () => {
      const matrix: ResultMatrix = [
        ['m', 'b', 'c', 'd'],
        ['m', 'b', 'c', 'd'],
        ['m', 'b', 'c', 'd'],
      ];
      expect(findWinLine(matrix)).toEqual({
        symbol: 'm',
        cells: [
          { row: 0, col: 0 },
          { row: 1, col: 0 },
          { row: 2, col: 0 },
        ],
      });
    });

    it('finds last column win', () => {
      const matrix: ResultMatrix = [
        ['x', 'p', 'q', 'w'],
        ['y', 'r', 's', 'w'],
        ['z', 't', 'u', 'w'],
      ];
      const result = findWinLine(matrix);
      expect(result?.symbol).toBe('w');
      expect(result?.cells.every((c) => c.col === 3)).toBe(true);
    });

    it('finds middle column win', () => {
      const matrix: ResultMatrix = [
        ['x', 'v', 'c', 'd'],
        ['y', 'v', 'c', 'd'],
        ['z', 'v', 'c', 'd'],
      ];
      expect(findWinLine(matrix)?.cells.every((c) => c.col === 1)).toBe(true);
    });
  });

  describe('priority and edge cases', () => {
    it('prefers horizontal win over vertical when both exist', () => {
      const matrix: ResultMatrix = [
        ['s', 's', 's', 'd'],
        ['s', 'b', 'c', 'd'],
        ['s', 'b', 'c', 'd'],
      ];
      const result = findWinLine(matrix);
      expect(result?.cells[0].row).toBe(0);
      expect(result?.symbol).toBe('s');
    });

    it('returns null when there is no win', () => {
      const matrix: ResultMatrix = [
        ['a', 'b', 'c', 'd'],
        ['d', 'a', 'b', 'c'],
        ['b', 'c', 'd', 'a'],
      ];
      expect(findWinLine(matrix)).toBeNull();
    });

    it('returns first horizontal win when multiple horizontal lines exist', () => {
      const matrix: ResultMatrix = [
        ['h', 'h', 'h', 'x'],
        ['g', 'g', 'g', 'x'],
        ['a', 'b', 'c', 'd'],
      ];
      const result = findWinLine(matrix);
      expect(result?.symbol).toBe('h');
      expect(result?.cells[0].row).toBe(0);
    });
  });
});

describe('generateLosingMatrix', () => {
  it('returns matrix without win lines', () => {
    const matrix = generateLosingMatrix(TEST_SYMBOLS);
    expect(findWinLine(matrix)).toBeNull();
  });

  it('returns 3x4 matrix', () => {
    const matrix = generateLosingMatrix(TEST_SYMBOLS);
    expect(matrix).toHaveLength(3);
    matrix.forEach((row) => expect(row).toHaveLength(4));
  });

  it('uses only symbols from the provided list', () => {
    const matrix = generateLosingMatrix(TEST_SYMBOLS);
    const flat = matrix.flat();
    flat.forEach((symbol) => expect(TEST_SYMBOLS).toContain(symbol));
  });

  it('produces only losing matrices over many runs', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(findWinLine(generateLosingMatrix(SYMBOLS))).toBeNull();
    }
  });
});

function expectWinLineMatchesMatrix(matrix: ResultMatrix, winLine: ReturnType<typeof findWinLine>): void {
  const detected = findWinLine(matrix);
  expect(detected).not.toBeNull();
  expect(detected).toEqual(winLine);
}

describe('generateWinningMatrix', () => {
  it('findWinLine matches returned winLine', () => {
    const { matrix, winLine } = generateWinningMatrix(TEST_SYMBOLS);
    expectWinLineMatchesMatrix(matrix, winLine);
  });

  it('keeps findWinLine aligned over many runs', () => {
    for (let i = 0; i < 200; i += 1) {
      const { matrix, winLine } = generateWinningMatrix(TEST_SYMBOLS);
      expectWinLineMatchesMatrix(matrix, winLine);
    }
  });

  it('aligns horizontal offset wins with findWinLine', () => {
    let foundOffsetWin = false;

    for (let i = 0; i < 500; i += 1) {
      const { matrix, winLine } = generateWinningMatrix(TEST_SYMBOLS);
      const cols = winLine.cells.map((cell) => cell.col).sort((a, b) => a - b);

      if (cols.join(',') === '1,2,3') {
        foundOffsetWin = true;
        expectWinLineMatchesMatrix(matrix, winLine);
        break;
      }
    }

    expect(foundOffsetWin).toBe(true);
  });

  it('produces only winning matrices over many runs', () => {
    for (let i = 0; i < 50; i += 1) {
      const { matrix } = generateWinningMatrix(TEST_SYMBOLS);
      expect(findWinLine(matrix)).not.toBeNull();
    }
  });

  it('generates both horizontal and vertical wins over many runs', () => {
    let horizontal = false;
    let vertical = false;

    for (let i = 0; i < 200; i += 1) {
      const { winLine } = generateWinningMatrix(TEST_SYMBOLS);
      const sameRow = winLine.cells.every((c) => c.row === winLine.cells[0].row);
      const sameCol = winLine.cells.every((c) => c.col === winLine.cells[0].col);
      if (sameRow) horizontal = true;
      if (sameCol) vertical = true;
      if (horizontal && vertical) break;
    }

    expect(horizontal).toBe(true);
    expect(vertical).toBe(true);
  });
});
