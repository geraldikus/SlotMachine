import { columnFromStop, evaluateWin, matrixFromStops, PAYTABLE, REEL_STRIPS } from '../../supabase/functions/_shared/slotMath';

describe('slotMath', () => {
  it('wraps a strip window around the end', () => {
    const strip = REEL_STRIPS[0];
    const stop = strip.length - 1;
    expect(columnFromStop(strip, stop)).toEqual([
      strip[stop],
      strip[0],
      strip[1],
    ]);
  });

  it('builds the same matrix and win from the same stops', () => {
    const stops = [3, 8, 1, 20];
    const first = matrixFromStops(stops);
    const second = matrixFromStops(stops);
    expect(second).toEqual(first);
    expect(evaluateWin(second, 10)).toEqual(evaluateWin(first, 10));
  });

  it('sums every winning line', () => {
    const matrix = [
      ['strawberry', 'strawberry', 'strawberry', 'raspberry'],
      ['red-cherry', 'red-cherry', 'red-cherry', 'red-cherry'],
      ['raspberry', 'black-cherry', 'strawberry', 'red-cherry'],
    ];
    const result = evaluateWin(matrix, 2);
    expect(result.lines).toEqual([
      [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
      [
        { row: 1, col: 0 },
        { row: 1, col: 1 },
        { row: 1, col: 2 },
        { row: 1, col: 3 },
      ],
    ]);
    expect(result.winAmount).toBe(2 * (PAYTABLE.strawberry[3] ?? 0) + 2 * (PAYTABLE['red-cherry'][4] ?? 0));
  });

  it('pays four matching symbols across a row', () => {
    const matrix = [
      ['raspberry', 'raspberry', 'raspberry', 'raspberry'],
      ['red-cherry', 'black-cherry', 'strawberry', 'black-berry-dark'],
      ['black-cherry', 'red-cherry', 'raspberry', 'strawberry'],
    ];
    const result = evaluateWin(matrix, 5);
    expect(result.lines).toEqual([[
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ]]);
    expect(result.winAmount).toBe(5 * (PAYTABLE.raspberry[4] ?? 0));
  });

  it('keeps dark and light berries as different symbols', () => {
    const matrix = [
      ['black-berry-dark', 'black-berry-light', 'black-berry-dark', 'black-berry-light'],
      ['red-cherry', 'raspberry', 'strawberry', 'black-cherry'],
      ['raspberry', 'red-cherry', 'black-cherry', 'strawberry'],
    ];
    expect(evaluateWin(matrix, 5).winAmount).toBe(0);
  });

  it('pays three of a kind from either end and ignores a gap', () => {
    const fromLeft = evaluateWin([
      ['raspberry', 'raspberry', 'raspberry', 'strawberry'],
      ['red-cherry', 'black-cherry', 'strawberry', 'black-berry-dark'],
      ['black-cherry', 'red-cherry', 'raspberry', 'black-berry-light'],
    ], 5);
    expect(fromLeft.lines).toEqual([[
      { row: 0, col: 0 },
      { row: 0, col: 1 },
      { row: 0, col: 2 },
    ]]);
    expect(fromLeft.winAmount).toBe(5 * (PAYTABLE.raspberry[3] ?? 0));

    const fromRight = evaluateWin([
      ['strawberry', 'raspberry', 'raspberry', 'raspberry'],
      ['red-cherry', 'black-cherry', 'strawberry', 'black-berry-dark'],
      ['black-cherry', 'red-cherry', 'raspberry', 'black-berry-light'],
    ], 5);
    expect(fromRight.lines).toEqual([[
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ]]);
    expect(fromRight.winAmount).toBe(5 * (PAYTABLE.raspberry[3] ?? 0));

    const gap = evaluateWin([
      ['raspberry', 'raspberry', 'strawberry', 'raspberry'],
      ['red-cherry', 'black-cherry', 'strawberry', 'black-berry-dark'],
      ['black-cherry', 'red-cherry', 'raspberry', 'black-berry-light'],
    ], 5);
    expect(gap.winAmount).toBe(0);
    expect(gap.lines).toEqual([]);
  });

  it('pays a full column at the three-of-a-kind multiplier', () => {
    const matrix = [
      ['black-berry-light', 'red-cherry', 'raspberry', 'black-cherry'],
      ['black-berry-light', 'raspberry', 'red-cherry', 'strawberry'],
      ['black-berry-light', 'black-cherry', 'strawberry', 'red-cherry'],
    ];
    const result = evaluateWin(matrix, 1.5);
    expect(result.lines).toEqual([
      [
        { row: 0, col: 0 },
        { row: 1, col: 0 },
        { row: 2, col: 0 },
      ],
    ]);
    expect(result.winAmount).toBe(1.5 * (PAYTABLE['black-berry-light'][3] ?? 0));
  });

  it('pays three strawberries on the right of a row', () => {
    const result = evaluateWin([
      ['raspberry', 'strawberry', 'strawberry', 'strawberry'],
      ['red-cherry', 'raspberry', 'black-cherry', 'black-berry-dark'],
      ['black-cherry', 'red-cherry', 'raspberry', 'black-berry-light'],
    ], 10);
    expect(result.lines).toEqual([[
      { row: 0, col: 1 },
      { row: 0, col: 2 },
      { row: 0, col: 3 },
    ]]);
    expect(result.winAmount).toBe(10 * (PAYTABLE.strawberry[3] ?? 0));
  });
});
