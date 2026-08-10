import { Container, Graphics, Text } from 'pixi.js';
import { BET_OPTIONS, formatFun } from './currency';
import { APP_HEIGHT, APP_WIDTH } from './layout';

const MENU_ITEM_HEIGHT = 40;
const MENU_COLUMNS = 3;
const HAMBURGER_SIZE = 36;

const LABEL_STYLE = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 12,
  fill: 0x8899aa,
  fontWeight: '600' as const,
};

const VALUE_STYLE = {
  fontFamily: 'Arial, sans-serif',
  fontSize: 18,
  fill: 0xffffff,
  fontWeight: 'bold' as const,
};

interface MenuItemParts {
  container: Container;
  background: Graphics;
  label: Text;
  amount: number;
}

function createHamburgerIcon(size: number): Graphics {
  const icon = new Graphics();
  const lineHeight = 3;
  const gap = 5;
  const startY = (size - (lineHeight * 3 + gap * 2)) / 2;

  for (let i = 0; i < 3; i += 1) {
    icon.roundRect(0, startY + i * (lineHeight + gap), size, lineHeight, 1.5).fill(0xffffff);
  }

  return icon;
}

export class BetSelector extends Container {
  private readonly boxWidth: number;
  private readonly betValue: Text;
  private readonly menuPanel: Container;
  private readonly overlay: Graphics;
  private readonly hamburgerButton: Container;
  private readonly menuItems: MenuItemParts[] = [];
  private currentBet: number;
  private menuOpen = false;
  private enabled = true;

  constructor(
    width: number,
    screenX: number,
    screenY: number,
    initialBet: number,
  ) {
    super();
    this.boxWidth = width;
    this.currentBet = initialBet;

    const background = new Graphics();
    background.roundRect(0, 0, width, 64, 8).fill({ color: 0x2a2a4a });
    this.addChild(background);

    const labelText = new Text({ text: 'TOTAL BET', style: LABEL_STYLE });
    labelText.position.set(12, 10);
    this.addChild(labelText);

    this.betValue = new Text({
      text: formatFun(initialBet),
      style: VALUE_STYLE,
    });
    this.betValue.position.set(12, 30);
    this.addChild(this.betValue);

    this.hamburgerButton = new Container();
    this.hamburgerButton.eventMode = 'static';
    this.hamburgerButton.cursor = 'pointer';

    const buttonBg = new Graphics();
    buttonBg.roundRect(0, 0, HAMBURGER_SIZE, HAMBURGER_SIZE, 8).fill({ color: 0x3a3a5a });
    this.hamburgerButton.addChild(buttonBg);

    const icon = createHamburgerIcon(20);
    icon.position.set(8, 8);
    this.hamburgerButton.addChild(icon);

    this.hamburgerButton.position.set(width - HAMBURGER_SIZE - 8, 14);
    this.hamburgerButton.on('pointerdown', () => this.toggleMenu());
    this.addChild(this.hamburgerButton);

    this.overlay = new Graphics();
    this.overlay.rect(0, 0, APP_WIDTH, APP_HEIGHT).fill({ color: 0x000000, alpha: 0.45 });
    this.overlay.position.set(-screenX, -screenY);
    this.overlay.eventMode = 'static';
    this.overlay.cursor = 'pointer';
    this.overlay.visible = false;
    this.overlay.on('pointerdown', () => this.closeMenu());
    this.addChild(this.overlay);

    this.menuPanel = this.createMenuPanel(width);
    this.menuPanel.visible = false;
    this.addChild(this.menuPanel);
    this.updateMenuSelection();
  }

  get bet(): number {
    return this.currentBet;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    this.hamburgerButton.alpha = value ? 1 : 0.45;
    this.hamburgerButton.eventMode = value ? 'static' : 'none';

    if (!value) {
      this.closeMenu();
    }
  }

  setBet(amount: number): void {
    this.currentBet = amount;
    this.betValue.text = formatFun(amount);
    this.updateMenuSelection();
  }

  private createMenuPanel(width: number): Container {
    const panel = new Container();
    const itemWidth = Math.floor((width - 16) / MENU_COLUMNS);
    const rows = Math.ceil(BET_OPTIONS.length / MENU_COLUMNS);
    const panelHeight = rows * MENU_ITEM_HEIGHT + 52;

    panel.position.set(0, -panelHeight - 8);

    const background = new Graphics();
    background.roundRect(0, 0, width, panelHeight, 10).fill({ color: 0x2a2a4a });
    background.roundRect(0, 0, width, panelHeight, 10).stroke({ color: 0x4ecdc4, width: 2 });
    panel.addChild(background);

    const title = new Text({
      text: 'SELECT BET',
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 12,
        fill: 0x8899aa,
        fontWeight: 'bold',
      },
    });
    title.position.set(12, 10);
    panel.addChild(title);

    BET_OPTIONS.forEach((amount, index) => {
      const col = index % MENU_COLUMNS;
      const row = Math.floor(index / MENU_COLUMNS);
      const item = this.createMenuItem(amount, itemWidth);
      item.container.position.set(8 + col * itemWidth, 36 + row * MENU_ITEM_HEIGHT);
      panel.addChild(item.container);
      this.menuItems.push(item);
    });

    return panel;
  }

  private createMenuItem(amount: number, width: number): MenuItemParts {
    const container = new Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';

    const background = new Graphics();
    background.roundRect(0, 0, width - 4, MENU_ITEM_HEIGHT - 4, 6).fill({ color: 0x3a3a5a });
    container.addChild(background);

    const label = new Text({
      text: formatFun(amount),
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: 13,
        fill: 0xffffff,
        fontWeight: 'bold',
      },
    });
    label.anchor.set(0.5);
    label.position.set((width - 4) / 2, (MENU_ITEM_HEIGHT - 4) / 2);
    container.addChild(label);

    container.on('pointerdown', (event) => {
      event.stopPropagation();
      this.selectBet(amount);
    });

    return { container, background, label, amount };
  }

  private updateMenuSelection(): void {
    for (const item of this.menuItems) {
      const selected = item.amount === this.currentBet;
      item.background.clear();
      item.background
        .roundRect(0, 0, Math.floor((this.boxWidth - 16) / MENU_COLUMNS) - 4, MENU_ITEM_HEIGHT - 4, 6)
        .fill({ color: selected ? 0x4ecdc4 : 0x3a3a5a });
      item.label.style.fill = selected ? 0x1a1a2e : 0xffffff;
    }
  }

  private selectBet(amount: number): void {
    this.currentBet = amount;
    this.betValue.text = formatFun(amount);
    this.updateMenuSelection();
    this.closeMenu();
  }

  private toggleMenu(): void {
    if (!this.enabled) return;

    if (this.menuOpen) {
      this.closeMenu();
    } else {
      this.openMenu();
    }
  }

  private openMenu(): void {
    this.menuOpen = true;
    this.overlay.visible = true;
    this.menuPanel.visible = true;
  }

  private closeMenu(): void {
    this.menuOpen = false;
    this.overlay.visible = false;
    this.menuPanel.visible = false;
  }
}
