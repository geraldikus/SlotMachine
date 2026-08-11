import { Container, Graphics } from 'pixi.js';
import { CellPosition, REEL_SPACING, REEL_WIDTH, SYMBOL_SIZE, VISIBLE_ROW_Y } from '../config/types';

const LINE_COLOR = 0xffe66d;
const GLOW_COLOR = 0x4ecdc4;

function sortCellsForLine(cells: CellPosition[]): CellPosition[] {
  const sameRow = cells.every((cell) => cell.row === cells[0].row);
  if (sameRow) {
    return [...cells].sort((a, b) => a.col - b.col);
  }

  const sameCol = cells.every((cell) => cell.col === cells[0].col);
  if (sameCol) {
    return [...cells].sort((a, b) => a.row - b.row);
  }

  return cells;
}

function getCellCenter(col: number, row: number): { x: number; y: number } {
  return {
    x: col * (REEL_WIDTH + REEL_SPACING) + REEL_WIDTH / 2,
    y: VISIBLE_ROW_Y[row as 0 | 1 | 2] + SYMBOL_SIZE / 2,
  };
}

export class WinLineOverlay extends Container {
  private readonly glowLine = new Graphics();
  private readonly mainLine = new Graphics();
  private readonly dots = new Graphics();
  private activeCells: CellPosition[] = [];

  constructor() {
    super();
    this.visible = false;
    this.addChild(this.glowLine);
    this.addChild(this.mainLine);
    this.addChild(this.dots);
  }

  show(cells: CellPosition[]): void {
    this.activeCells = sortCellsForLine(cells);
    this.visible = true;
    this.redraw(performance.now());
  }

  hide(): void {
    this.activeCells = [];
    this.visible = false;
    this.glowLine.clear();
    this.mainLine.clear();
    this.dots.clear();
  }

  update(): void {
    if (!this.visible || this.activeCells.length === 0) return;
    this.redraw(performance.now());
  }

  private redraw(time: number): void {
    const points = this.activeCells.map(({ row, col }) => getCellCenter(col, row));
    const pulse = 0.65 + Math.sin(time / 220) * 0.35;
    const mainWidth = 5 + Math.sin(time / 180) * 1.5;
    const glowWidth = mainWidth + 10;
    const dotRadius = 7 + Math.sin(time / 200) * 2;

    this.drawPolyline(this.glowLine, points, {
      color: GLOW_COLOR,
      width: glowWidth,
      alpha: pulse * 0.35,
    });

    this.drawPolyline(this.mainLine, points, {
      color: LINE_COLOR,
      width: mainWidth,
      alpha: pulse,
    });

    this.dots.clear();
    for (const point of points) {
      this.dots.circle(point.x, point.y, dotRadius + 4);
      this.dots.fill({ color: GLOW_COLOR, alpha: pulse * 0.25 });
      this.dots.circle(point.x, point.y, dotRadius);
      this.dots.fill({ color: LINE_COLOR, alpha: pulse });
    }
  }

  private drawPolyline(
    graphics: Graphics,
    points: { x: number; y: number }[],
    style: { color: number; width: number; alpha: number },
  ): void {
    graphics.clear();

    if (points.length < 2) {
      if (points.length === 1) {
        graphics.circle(points[0].x, points[0].y, style.width);
        graphics.fill({ color: style.color, alpha: style.alpha });
      }
      return;
    }

    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      graphics.lineTo(points[i].x, points[i].y);
    }

    graphics.stroke({
      color: style.color,
      width: style.width,
      alpha: style.alpha,
      cap: 'round',
      join: 'round',
    });
  }
}
