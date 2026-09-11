import { Container } from 'pixi.js';
import gsap from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';
import * as PIXI from 'pixi.js';
import type { SymbolCell } from './SymbolCell';
import type { WinLineOverlay } from './WinLineOverlay';
import type { WinBanner } from '../ui/WinBanner';
import type { SoundService } from '../services/SoundService';
import type { AlienCharacter } from '../character/AlienCharacter';

gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

interface WinContext {
  highlighted: SymbolCell[];
  dimmed: SymbolCell[];
  overlay: WinLineOverlay;
  banner: WinBanner;
  amount: number;
  gameRoot: Container;
  soundService: SoundService;
  alienCharacter?: AlienCharacter;
}

export class WinPresentation {
  private introTl?: gsap.core.Timeline;
  private idleTl?: gsap.core.Timeline;
  private introDone: Promise<void> | null = null;
  private resolveIntroDone: (() => void) | null = null;

  play(ctx: WinContext): void {
    this.kill();

    this.introDone = new Promise<void>((resolve) => {
      this.resolveIntroDone = resolve;
    });

    const tl = gsap.timeline({
      defaults: { ease: 'power2.out' },
      onComplete: () => {
        this.startIdleLoop(ctx);
        this.resolveIntroDone?.();
        this.resolveIntroDone = null;
      },
    });

    // ── 1. Anticipation ──
    tl.to(
      ctx.dimmed.map((c) => c),
      {
        pixi: { alpha: 0.25 },
        duration: 0.12,
      },
    );

    // Screen shake
    const originalX = ctx.gameRoot.x;
    tl.to(
      ctx.gameRoot,
      {
        x: originalX + 4,
        duration: 0.04,
        yoyo: true,
        repeat: 3,
        ease: 'power1.inOut',
      },
      '<',
    );

    // ── 2. Symbol POP (stagger from center) ──
    const pulseWraps = ctx.highlighted.map((c) => c.pulseWrap);
    
    tl.fromTo(
      pulseWraps,
      { pixi: { scale: 0.85, alpha: 0.6 } },
      {
        pixi: { scale: 1.18, alpha: 1 },
        duration: 0.4,
        ease: 'back.out(2.5)',
        stagger: { each: 0.07, from: 'center' },
      },
      '-=0.05',
    );

    // Откат к базовому размеру
    tl.to(
      pulseWraps,
      {
        pixi: { scale: 1 },
        duration: 0.25,
        ease: 'power3.out',
        stagger: { each: 0.04, from: 'center' },
      },
    );

    // ── 3. Win line ──
    tl.fromTo(
      ctx.overlay,
      { pixi: { alpha: 0 } },
      { pixi: { alpha: 1 }, duration: 0.2 },
      '-=0.15',
    );

    // Точки линии — pop по очереди
    const dots = ctx.overlay.dots;
    if (dots.length > 0) {
      tl.from(
        dots,
        {
          pixi: { scale: 0 },
          duration: 0.3,
          ease: 'back.out(3)',
          stagger: 0.1,
        },
        '-=0.1',
      );
    }

    // ── 4. Banner ──
    const bannerBaseY = ctx.banner.y + 40; // prepareShow установил y = baseY - 40
    tl.to(
      ctx.banner,
      {
        pixi: { y: bannerBaseY, alpha: 1, scale: 1 },
        duration: 0.45,
        ease: 'back.out(1.7)',
      },
      '-=0.1',
    );

    // Punch на сумме
    tl.fromTo(
      ctx.banner.amountText,
      { pixi: { scale: 1.4 } },
      { pixi: { scale: 1 }, duration: 0.35, ease: 'power4.out' },
      '-=0.2',
    );

    // ── 5. Alien death ──
    if (ctx.alienCharacter) {
      tl.add(() => {
        ctx.alienCharacter?.playDeath();
      }, '-=0.3');
    }

    this.introTl = tl;
  }

  private startIdleLoop(ctx: WinContext): void {
    this.idleTl = gsap.timeline({ repeat: -1 });

    // Пульс символов
    const pulseWraps = ctx.highlighted.map((c) => c.pulseWrap);
    this.idleTl.to(
      pulseWraps,
      {
        pixi: { scale: 1.1 },
        duration: 0.55,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      },
      0,
    );

    // Пульс glow линии
    this.idleTl.to(
      ctx.overlay.glowLine,
      {
        pixi: { alpha: 0.5 },
        duration: 0.55,
        yoyo: true,
        repeat: 1,
        ease: 'sine.inOut',
      },
      0,
    );
  }

  kill(): void {
    this.introTl?.kill();
    this.idleTl?.kill();
    this.introTl = undefined;
    this.idleTl = undefined;
    this.resolveIntroDone?.();
    this.resolveIntroDone = null;
    this.introDone = null;
  }

  waitForIntro(): Promise<void> {
    return this.introDone ?? Promise.resolve();
  }
}
