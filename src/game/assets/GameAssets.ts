import * as THREE from 'three';
import { ENV_FRAMES, NINJA_FRAMES, ZOMBIE_FRAMES } from './frames';
import { cropTexture, prepareTexture } from './textureTools';

export type GameAssets = {
  source: {
    arenaScenery: THREE.Texture;
    approvedCombatNight: THREE.Texture;
    approvedBridgeUltimate: THREE.Texture;
    environmentVfxSheet: THREE.Texture;
    ninjaSheet: THREE.Texture;
    zombieSheet: THREE.Texture;
  };
  ninja: {
    idle: THREE.Texture[];
    run: THREE.Texture[];
    attack: THREE.Texture[];
    ultimate: THREE.Texture[];
  };
  zombie: {
    walkA: THREE.Texture[];
    walkB: THREE.Texture[];
    brute: THREE.Texture[];
    dead: THREE.Texture[];
  };
  environment: {
    tiles: THREE.Texture[];
    lanterns: THREE.Texture[];
    torii: THREE.Texture[];
    bamboo: THREE.Texture[];
    leaves: THREE.Texture[];
    cracks: THREE.Texture[];
  };
};

const PATHS = {
  arenaScenery: '/assets/generated/arena-scenery.png',
  approvedCombatNight: '/assets/source/approved-combat-night.png',
  approvedBridgeUltimate: '/assets/source/approved-bridge-ultimate.png',
  environmentVfxSheet: '/assets/source/environment-vfx-sheet.png',
  ninjaSheet: '/assets/source/ninja-sheet.png',
  zombieSheet: '/assets/source/zombie-sheet.png',
};

export async function loadGameAssets(): Promise<GameAssets> {
  const loader = new THREE.TextureLoader();
  const [arenaScenery, approvedCombatNight, approvedBridgeUltimate, environmentVfxSheet, ninjaSheet, zombieSheet] =
    await Promise.all([
      loader.loadAsync(PATHS.arenaScenery),
      loader.loadAsync(PATHS.approvedCombatNight),
      loader.loadAsync(PATHS.approvedBridgeUltimate),
      loader.loadAsync(PATHS.environmentVfxSheet),
      loader.loadAsync(PATHS.ninjaSheet),
      loader.loadAsync(PATHS.zombieSheet),
    ]);

  [
    arenaScenery,
    approvedCombatNight,
    approvedBridgeUltimate,
    environmentVfxSheet,
    ninjaSheet,
    zombieSheet,
  ].forEach(prepareTexture);

  const cropEnv = (frame: { x: number; y: number; w: number; h: number }) =>
    cropTexture(environmentVfxSheet, frame, { transparentBackground: true, threshold: 24, feather: 16 });
  const cropNinja = (frame: { x: number; y: number; w: number; h: number }, padding: number) =>
    cropTexture(ninjaSheet, frame, {
      transparentBackground: true,
      threshold: 34,
      feather: 28,
      padding,
      trimTransparent: true,
      trimPadding: 5,
      removeIsolatedAlpha: true,
      isolatedAlphaMinPixels: 12,
    });
  const cropZombie = (frame: { x: number; y: number; w: number; h: number }, padding: number) =>
    cropTexture(zombieSheet, frame, {
      transparentBackground: true,
      threshold: 28,
      feather: 20,
      padding,
      trimTransparent: true,
      trimPadding: 5,
      removeIsolatedAlpha: true,
      isolatedAlphaMinPixels: 34,
    });

  return {
    source: {
      arenaScenery,
      approvedCombatNight,
      approvedBridgeUltimate,
      environmentVfxSheet,
      ninjaSheet,
      zombieSheet,
    },
    ninja: {
      idle: NINJA_FRAMES.idle.map((frame) => cropNinja(frame, 24)),
      run: NINJA_FRAMES.run.map((frame) => cropNinja(frame, 24)),
      attack: NINJA_FRAMES.attack.map((frame) => cropNinja(frame, 34)),
      ultimate: NINJA_FRAMES.ultimate.map((frame) => cropNinja(frame, 34)),
    },
    zombie: {
      walkA: ZOMBIE_FRAMES.walkA.map((frame) => cropZombie(frame, 12)),
      walkB: ZOMBIE_FRAMES.walkB.map((frame) => cropZombie(frame, 12)),
      brute: ZOMBIE_FRAMES.brute.map((frame) => cropZombie(frame, 14)),
      dead: ZOMBIE_FRAMES.dead.map((frame) => cropZombie(frame, 14)),
    },
    environment: {
      tiles: ENV_FRAMES.tiles.map((frame) => cropTexture(environmentVfxSheet, frame)),
      lanterns: ENV_FRAMES.lanterns.map(cropEnv),
      torii: ENV_FRAMES.torii.map(cropEnv),
      bamboo: ENV_FRAMES.bamboo.map(cropEnv),
      leaves: ENV_FRAMES.leaves.map(cropEnv),
      cracks: ENV_FRAMES.cracks.map(cropEnv),
    },
  };
}
