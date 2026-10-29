import { Container, Graphics, Rectangle, Text } from 'pixi.js';
import { formatFun } from '../../config/currency';
import { RoundRecord } from '../../round/types';

const PANEL_WIDTH = 360;
const PADDING = 12;
const HEADER_HEIGHT = 36;
const ROW_HEIGHT = 56;
const VISIBLE_ROWS = 6;
const CLOSE_SIZE = 28;

export class HistoryPanel extends Container {
  private readonly list = new Container();
  private readonly message: Text;
  private readonly background: Graphics;
  private panelHeight = HEADER_HEIGHT + PADDING * 2;
  private rounds: RoundRecord[] = [];
  private scrollIndex = 0;

  constructor(private readonly onReplay: (roundId: string) => void) {
    super();
    this.visible = false;
    this.eventMode = 'none';
    this.zIndex = 80;

    this.background = new Graphics();
    this.addChild(this.background);

    const title = new Text({
      text: 'HISTORY',
      style: { fill: 0xffffff, fontSize: 16, fontWeight: 'bold', fontFamily: 'Arial, sans-serif' },
    });
    title.position.set(PADDING, 14);
    this.addChild(title);

    const close = new Container();
    close.eventMode = 'static';
    close.cursor = 'pointer';
    const closeBackground = new Graphics();
    closeBackground.roundRect(0, 0, CLOSE_SIZE, CLOSE_SIZE, 6).fill({ color: 0x3a3a5c });
    close.addChild(closeBackground);
    const closeLabel = new Text({
      text: '×',
      style: { fill: 0xffffff, fontSize: 18, fontFamily: 'Arial, sans-serif' },
    });
    closeLabel.anchor.set(0.5);
    closeLabel.position.set(CLOSE_SIZE / 2, CLOSE_SIZE / 2);
    close.addChild(closeLabel);
    close.position.set(PANEL_WIDTH - PADDING - CLOSE_SIZE, 10);
    close.on('pointertap', (event) => {
      event.stopPropagation();
      this.hide();
    });
    this.addChild(close);

    this.list.position.set(PADDING, HEADER_HEIGHT + PADDING);
    this.addChild(this.list);

    this.message = new Text({
      text: '',
      style: { fill: 0xc9d1d9, fontSize: 14, fontFamily: 'Arial, sans-serif' },
    });
    this.message.position.set(PADDING, HEADER_HEIGHT + PADDING);
    this.addChild(this.message);

    this.on('wheel', this.onWheel);
  }

  showLoading(): void {
    this.rounds = [];
    this.scrollIndex = 0;
    this.list.removeChildren();
    this.message.text = 'Loading...';
    this.message.visible = true;
    this.resize(28);
    this.show();
  }

  setRounds(rounds: RoundRecord[]): void {
    this.rounds = rounds;
    this.scrollIndex = 0;
    this.renderRows();
    this.show();
  }

  hide(): void {
    this.visible = false;
    this.eventMode = 'none';
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.position.set(
      Math.max(16, (screenWidth - PANEL_WIDTH) / 2),
      Math.max(16, (screenHeight - this.panelHeight) / 2),
    );
  }

  private show(): void {
    this.visible = true;
    this.eventMode = 'static';
  }

  private renderRows(): void {
    this.list.removeChildren();

    if (this.rounds.length === 0) {
      this.message.text = 'No rounds yet';
      this.message.visible = true;
      this.resize(28);
      return;
    }

    this.message.visible = false;
    const visible = this.rounds.slice(this.scrollIndex, this.scrollIndex + VISIBLE_ROWS);
    visible.forEach((round, index) => {
      const row = this.createRow(round);
      row.y = index * ROW_HEIGHT;
      this.list.addChild(row);
    });
    this.resize(visible.length * ROW_HEIGHT);
  }

  private resize(contentHeight: number): void {
    this.panelHeight = HEADER_HEIGHT + PADDING + contentHeight + PADDING;
    this.background.clear();
    this.background.roundRect(0, 0, PANEL_WIDTH, this.panelHeight, 12).fill({ color: 0x1e1e36, alpha: 0.98 });
    this.background.roundRect(0, 0, PANEL_WIDTH, this.panelHeight, 12).stroke({ width: 1, color: 0x3a3a5a });
    this.hitArea = new Rectangle(0, 0, PANEL_WIDTH, this.panelHeight);
  }

  private createRow(round: RoundRecord): Container {
    const row = new Container();
    const width = PANEL_WIDTH - PADDING * 2;

    const background = new Graphics();
    background.roundRect(0, 0, width, ROW_HEIGHT - 6, 8).fill({ color: 0x2a2a4a });
    row.addChild(background);

    const when = new Text({
      text: formatRoundTime(round.createdAt),
      style: { fill: 0xffffff, fontSize: 13, fontFamily: 'Arial, sans-serif' },
    });
    when.position.set(10, 6);
    row.addChild(when);

    const amounts = new Text({
      text: `${formatFun(round.bet)} → ${formatFun(round.totalWin)}`,
      style: { fill: 0xb8c0cc, fontSize: 12, fontFamily: 'Arial, sans-serif' },
    });
    amounts.position.set(10, 26);
    row.addChild(amounts);

    const replay = new Container();
    replay.eventMode = 'static';
    replay.cursor = 'pointer';
    const replayBackground = new Graphics();
    replayBackground.roundRect(0, 0, 72, 28, 6).fill({ color: 0x3d5a80 });
    replay.addChild(replayBackground);
    const replayLabel = new Text({
      text: 'Replay',
      style: { fill: 0xffffff, fontSize: 13, fontWeight: 'bold', fontFamily: 'Arial, sans-serif' },
    });
    replayLabel.anchor.set(0.5);
    replayLabel.position.set(36, 14);
    replay.addChild(replayLabel);
    replay.position.set(width - 82, 11);
    replay.on('pointertap', (event) => {
      event.stopPropagation();
      this.onReplay(round.id);
    });
    row.addChild(replay);

    return row;
  }

  private onWheel = (event: { deltaY: number; stopPropagation: () => void }): void => {
    const maxIndex = Math.max(0, this.rounds.length - VISIBLE_ROWS);
    if (maxIndex === 0) {
      return;
    }

    event.stopPropagation();
    const next = this.scrollIndex + (event.deltaY > 0 ? 1 : -1);
    this.scrollIndex = Math.min(maxIndex, Math.max(0, next));
    this.renderRows();
  };
}

function formatRoundTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
