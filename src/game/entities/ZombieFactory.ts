import * as THREE from 'three';
import type { GameAssets } from '../assets/GameAssets';
import { makeSpriteMaterial, scaleSpriteToTexture } from '../assets/textureTools';
import { randomChoice, randomRange, vec2 } from '../math';
import type { ZombieState } from '../types';
import { ZOMBIE_RADIUS } from '../constants';

let nextZombieId = 1;

export function resetZombieIds(): void {
  nextZombieId = 1;
}

export function createZombie(
  assets: GameAssets,
  position: { x: number; y: number },
  wave: number,
): ZombieState {
  const variantRoll = Math.random();
  const variant = variantRoll > 0.86 && wave > 2 ? 2 : variantRoll > 0.52 ? 1 : 0;
  const frameSet = variant === 2 ? assets.zombie.brute : variant === 1 ? assets.zombie.walkB : assets.zombie.walkA;
  const sprite = new THREE.Sprite(makeSpriteMaterial(randomChoice(frameSet)));
  const baseHeight = variant === 2 ? randomRange(2.24, 2.66) : randomRange(1.92, 2.24);
  scaleSpriteToTexture(sprite, baseHeight);
  sprite.userData.baseHeight = baseHeight;
  sprite.userData.facingSign = 1;
  sprite.position.set(position.x, 0.64, position.y);
  sprite.renderOrder = 16;
  sprite.name = 'zombie';

  const healthMultiplier = 1 + wave * 0.08;
  const maxHealth = variant === 2 ? 132 * healthMultiplier : 78 * healthMultiplier;

  return {
    id: nextZombieId++,
    position: vec2(position.x, position.y),
    velocity: vec2(0, 0),
    health: maxHealth,
    maxHealth,
    speed: (variant === 2 ? 1.35 : randomRange(1.55, 2.2)) + wave * 0.035,
    radius: variant === 2 ? ZOMBIE_RADIUS * 1.25 : ZOMBIE_RADIUS,
    damage: variant === 2 ? 15 : 9,
    attackCooldown: randomRange(0.2, 0.8),
    stagger: 0,
    knockback: vec2(0, 0),
    variant,
    animTime: randomRange(0, 1),
    sprite,
  };
}

export function zombieFramesFor(assets: GameAssets, zombie: ZombieState): THREE.Texture[] {
  if (zombie.variant === 2) {
    return assets.zombie.brute;
  }
  return zombie.variant === 1 ? assets.zombie.walkB : assets.zombie.walkA;
}
