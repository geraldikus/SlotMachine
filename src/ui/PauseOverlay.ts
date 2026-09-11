const DEFAULT_MESSAGE = 'Tap to continue';

export class PauseOverlay {
  private readonly root: HTMLDivElement;
  private readonly messageEl: HTMLParagraphElement;
  private tapPromise: Promise<void> | null = null;
  private resolveTap: (() => void) | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'pause-overlay';
    this.root.style.display = 'none';

    this.messageEl = document.createElement('p');
    this.messageEl.className = 'pause-overlay__message';
    this.messageEl.textContent = DEFAULT_MESSAGE;

    this.root.appendChild(this.messageEl);
    document.body.appendChild(this.root);

    this.root.addEventListener('pointerdown', this.handleTap);
  }

  show(message = DEFAULT_MESSAGE): void {
    this.messageEl.textContent = message;
    this.root.style.display = 'flex';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  waitForTap(): Promise<void> {
    if (this.tapPromise) {
      return this.tapPromise;
    }

    this.tapPromise = new Promise<void>((resolve) => {
      this.resolveTap = resolve;
    });

    return this.tapPromise;
  }

  destroy(): void {
    this.root.removeEventListener('pointerdown', this.handleTap);
    this.root.remove();
    this.clearTapWait();
  }

  private readonly handleTap = (event: PointerEvent): void => {
    event.preventDefault();
    this.clearTapWait();
  };

  private clearTapWait(): void {
    if (this.resolveTap) {
      this.resolveTap();
      this.resolveTap = null;
    }
    this.tapPromise = null;
  }
}
