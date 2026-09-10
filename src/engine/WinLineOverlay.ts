import { Container, Graphics } from 'pixi.js';
import { CellPosition, REEL_SPACING, REEL_WIDTH, SYMBOL_SIZE, VISIBLE_ROW_Y } from '../config/types';

const LINE_COLOR = 0xffe66d;
const GLOW_COLOR = 0x4ecdc4;
const MAIN_LINE_WIDTH = 5;
const GLOW_EXTRA_WIDTH = 10;
const DOT_RADIUS = 7;
const DOT_GLOW_PADDING = 4;

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
  private readonly dotGlow = new Graphics();
  private readonly dotCore = new Graphics();

  constructor() {
    super();
    this.visible = false;
    this.addChild(this.glowLine);
    this.addChild(this.mainLine);
    this.addChild(this.dotGlow);
    this.addChild(this.dotCore);
  }

  show(cells: CellPosition[]): void {
    const points = sortCellsForLine(cells).map(({ row, col }) => getCellCenter(col, row));
    this.drawGeometry(points);
    this.visible = true;
    this.update(performance.now());
  }

  hide(): void {
    this.visible = false;
    this.glowLine.clear();
    this.mainLine.clear();
    this.dotGlow.clear();
    this.dotCore.clear();
    this.glowLine.alpha = 1;
    this.dotGlow.alpha = 1;
  }

  update(time: number): void {
    if (!this.visible) return;

    const pulse = 0.65 + Math.sin(time / 220) * 0.35;
    this.glowLine.alpha = pulse * 0.35;
    this.dotGlow.alpha = pulse * 0.25;
  }

  private drawGeometry(points: { x: number; y: number }[]): void {
    this.glowLine.clear();
    this.mainLine.clear();
    this.dotGlow.clear();
    this.dotCore.clear();

    this.drawPolyline(this.glowLine, points, {
      color: GLOW_COLOR,
      width: MAIN_LINE_WIDTH + GLOW_EXTRA_WIDTH,
      alpha: 1,
    });

    this.drawPolyline(this.mainLine, points, {
      color: LINE_COLOR,
      width: MAIN_LINE_WIDTH,
      alpha: 1,
    });

    for (const point of points) {
      this.dotGlow.circle(point.x, point.y, DOT_RADIUS + DOT_GLOW_PADDING);
      this.dotGlow.fill({ color: GLOW_COLOR, alpha: 1 });

      this.dotCore.circle(point.x, point.y, DOT_RADIUS);
      this.dotCore.fill({ color: LINE_COLOR, alpha: 1 });
    }
  }

  private drawPolyline(
    graphics: Graphics,
    points: { x: number; y: number }[],
    style: { color: number; width: number; alpha: number },
  ): void {
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
