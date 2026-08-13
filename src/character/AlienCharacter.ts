import { Container, DestroyOptions, FederatedPointerEvent } from 'pixi.js';
import { Spine } from '@esotericsoftware/spine-pixi-v8';
import type { AlienLayout } from '../layout/types';

const PUPIL_BONE_NAME = 'eye-pupil';
const EYE_BONE_NAME = 'eye';
const PUPIL_MAX_OFFSET = 12;
const EYE_MAX_TURN = 25;

export class AlienCharacter extends Container {
  private readonly spine: Spine;
  private pointerRoot: Container | null = null;
  private readonly pointerPoint = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };

  constructor() {
    super();

    this.spine = Spine.from({
      skeleton: 'alienData',
      atlas: 'alienAtlas',
    });

    this.addChild(this.spine);
    this.setupLookAt();
  }

  /** Subscribe to pointer moves on the stage (or any parent) for eye tracking. */
  attachPointerTracking(root: Container): void {
    this.pointerRoot = root;
    root.eventMode = 'static';
    root.on('globalpointermove', this.onGlobalPointerMove);
  }

  /** Position in gameRoot design coordinates (desktop profile). */
  applyLayout(layout: AlienLayout): void {
    this.position.set(layout.x, layout.y);
    this.spine.scale.set(layout.scale);
  }

  override destroy(options?: DestroyOptions): void {
    if (this.pointerRoot) {
      this.pointerRoot.off('globalpointermove', this.onGlobalPointerMove);
      this.pointerRoot = null;
    }

    this.spine.destroy(options);
    super.destroy(options);
  }

  playAnimation(name: string, loop = false): void {
    this.spine.state.setAnimation(0, name, loop);
  }

  playHit(): void {
    this.spine.state.setAnimation(0, 'jump', false);

    this.spine.state.addListener({
      complete: (entry) => {
        if (entry.animation?.name === 'jump') {
          this.spine.skeleton.setupPose();
          this.spine.state.clearTracks();
        }
      },
    });
  }

  playDeath(): Promise<void> {
    return new Promise((resolve) => {
      const entry = this.spine.state.setAnimation(0, 'death', false);
      if (!entry?.animation) {
        resolve();
        return;
      }

      const listener = {
        complete: (completedEntry: { animation?: { name: string } | null }) => {
          if (completedEntry.animation?.name !== 'death') return;
          this.spine.state.removeListener(listener);
          resolve();
        },
      };

      this.spine.state.addListener(listener);
    });
  }

  private readonly onGlobalPointerMove = (event: FederatedPointerEvent): void => {
    this.pointerPoint.x = event.global.x;
    this.pointerPoint.y = event.global.y;
  };

  private setupLookAt(): void {
    this.spine.beforeUpdateWorldTransforms = () => {
      this.updateEyeRotation();
      this.updatePupilOffset();
    };
  }

  /** Rotate the eye bone toward the cursor (parent-local space). */
  private updateEyeRotation(): void {
    const eye = this.spine.skeleton.findBone(EYE_BONE_NAME);
    if (!eye) return;

    const target = { x: this.pointerPoint.x, y: this.pointerPoint.y };
    this.spine.pixiWorldCoordinatesToBone(target, eye);

    const dx = target.x - eye.pose.x;
    const dy = target.y - eye.pose.y;
    const desiredRotation = Math.atan2(dy, dx) * (180 / Math.PI);
    const baseRotation = eye.data.setupPose.rotation;

    let delta = desiredRotation - baseRotation;
    while (delta > 180) delta -= 360;
    while (delta < -180) delta += 360;

    const clampedDelta = Math.max(-EYE_MAX_TURN, Math.min(EYE_MAX_TURN, delta));
    eye.pose.rotation = baseRotation + clampedDelta;
  }

  /** Shift the pupil slightly toward the cursor. */
  private updatePupilOffset(): void {
    const pupil = this.spine.skeleton.findBone(PUPIL_BONE_NAME);
    if (!pupil) return;

    const target = { x: this.pointerPoint.x, y: this.pointerPoint.y };
    this.spine.pixiWorldCoordinatesToBone(target, pupil);

    const baseX = pupil.data.setupPose.x;
    const baseY = pupil.data.setupPose.y;
    let dx = target.x - baseX;
    let dy = target.y - baseY;
    const distance = Math.hypot(dx, dy);

    if (distance > PUPIL_MAX_OFFSET) {
      const scale = PUPIL_MAX_OFFSET / distance;
      dx *= scale;
      dy *= scale;
    }

    pupil.pose.x = baseX + dx;
    pupil.pose.y = baseY + dy;
  }
}
