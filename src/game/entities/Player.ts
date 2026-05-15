import * as THREE from 'three';
import { PLAYER_MAX_HEALTH } from '../constants';
import type { GameAssets } from '../assets/GameAssets';
import { makeSpriteMaterial, scaleSpriteToTexture } from '../assets/textureTools';
import { vec2 } from '../math';
import type { PlayerState } from '../types';

export class Player {
  readonly state: PlayerState = {
    position: vec2(0, 0),
    velocity: vec2(0, 0),
    facing: 0,
    health: PLAYER_MAX_HEALTH,
    isAlive: true,
    attackTimer: 0,
    attackDuration: 0,
    attackCooldown: 0,
    comboIndex: 0,
    comboWindow: 0,
    ultimateCooldown: 0,
    invulnerability: 0,
    hitIds: new Set<number>(),
  };

  readonly sprite: THREE.Sprite;
  private animTimer = 0;
  private animFrame = 0;
  private facingSign = 1;
  private readonly baseHeight = 2.25;

  constructor(private readonly assets: GameAssets) {
    this.sprite = new THREE.Sprite(makeSpriteMaterial(assets.ninja.idle[0]));
    this.sprite.name = 'player-ninja';
    scaleSpriteToTexture(this.sprite, this.baseHeight, this.facingSign);
    this.sprite.renderOrder = 20;
    this.syncSprite();
  }

  reset(): void {
    this.state.position = vec2(0, 0);
    this.state.velocity = vec2(0, 0);
    this.state.facing = 0;
    this.state.health = PLAYER_MAX_HEALTH;
    this.state.isAlive = true;
    this.state.attackTimer = 0;
    this.state.attackDuration = 0;
    this.state.attackCooldown = 0;
    this.state.comboIndex = 0;
    this.state.comboWindow = 0;
    this.state.ultimateCooldown = 0;
    this.state.invulnerability = 5.0;
    this.state.hitIds.clear();
    this.animTimer = 0;
    this.animFrame = 0;
    this.syncSprite();
  }

  updateAnimation(dt: number): void {
    const speed = Math.hypot(this.state.velocity.x, this.state.velocity.y);
    const attackActive = this.state.attackTimer > 0;
    const moving = speed > 0.1;
    const frames = attackActive ? this.assets.ninja.attack : moving ? this.assets.ninja.run : this.assets.ninja.idle;
    const frameRate = attackActive ? 0.055 : 0.085;

    if (!attackActive && !moving) {
      this.animTimer = 0;
      this.animFrame = 0;
    } else {
      this.animTimer += dt;
      if (this.animTimer >= frameRate) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % frames.length;
      }
    }

    if (attackActive) {
      const attackProgress = 1 - this.state.attackTimer / Math.max(this.state.attackDuration, 0.001);
      this.animFrame = Math.min(frames.length - 1, Math.floor(attackProgress * frames.length));
    }

    const material = this.sprite.material as THREE.SpriteMaterial;
    material.map = frames[this.animFrame % frames.length];
    material.rotation = 0;
    material.opacity = this.state.invulnerability > 0 ? 0.74 + Math.sin(performance.now() / 44) * 0.18 : 1;
    material.needsUpdate = true;
    this.updateFacingFlip();
    this.syncSprite();
  }

  takeDamage(amount: number): boolean {
    if (!this.state.isAlive || this.state.invulnerability > 0) {
      return false;
    }

    this.state.health = Math.max(0, this.state.health - amount);
    this.state.invulnerability = 0.42;
    if (this.state.health <= 0) {
      this.state.isAlive = false;
    }
    return true;
  }

  syncSprite(): void {
    this.sprite.position.set(this.state.position.x, 0.7, this.state.position.y);
  }

  private updateFacingFlip(): void {
    const horizontalFacing = Math.cos(this.state.facing);
    if (horizontalFacing < -0.2) {
      this.facingSign = -1;
    } else if (horizontalFacing > 0.2) {
      this.facingSign = 1;
    }
    scaleSpriteToTexture(this.sprite, this.baseHeight, this.facingSign);
  }
}
