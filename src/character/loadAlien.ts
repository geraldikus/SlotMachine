import { Assets } from 'pixi.js';
import '@esotericsoftware/spine-pixi-v8';

const ALIEN_SKELETON = '/assets/alien.json';
const ALIEN_ATLAS = '/assets/alien.atlas';

export async function loadAlienAssets(): Promise<void> {
  await Assets.load([
    { alias: 'alienData', src: ALIEN_SKELETON },
    { alias: 'alienAtlas', src: ALIEN_ATLAS },
  ]);
}
