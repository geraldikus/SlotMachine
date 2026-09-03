import { Assets } from 'pixi.js';
import '@esotericsoftware/spine-pixi-v8';
import { assetUrl } from '../utils/assetUrl';

const ALIEN_SKELETON = assetUrl('assets/alien.json');
const ALIEN_ATLAS = assetUrl('assets/alien.atlas');

export async function loadAlienAssets(): Promise<void> {
  await Assets.load([
    { alias: 'alienData', src: ALIEN_SKELETON },
    { alias: 'alienAtlas', src: ALIEN_ATLAS },
  ]);
}
