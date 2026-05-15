import type { Sprite } from 'three';
import type { Vec2 } from './math';

export type GamePhase = 'loading' | 'menu' | 'break' | 'active' | 'dead';

export type PlayerState = {
  position: Vec2;
  velocity: Vec2;
  facing: number;
  health: number;
  isAlive: boolean;
  attackTimer: number;
  attackDuration: number;
  attackCooldown: number;
  comboIndex: number;
  comboWindow: number;
  ultimateCooldown: number;
  invulnerability: number;
  hitIds: Set<number>;
};

export type ZombieState = {
  id: number;
  position: Vec2;
  velocity: Vec2;
  health: number;
  maxHealth: number;
  speed: number;
  radius: number;
  damage: number;
  attackCooldown: number;
  stagger: number;
  knockback: Vec2;
  variant: number;
  animTime: number;
  sprite: Sprite;
};

export type WaveState = {
  wave: number;
  phase: GamePhase;
  phaseTimer: number;
  spawnTimer: number;
  spawnedThisWave: number;
  targetThisWave: number;
};

export type RunStats = {
  kills: number;
  totalDamageTaken: number;
};

export type AttackSpec = {
  combo: number;
  damage: number;
  radius: number;
  arcRadians: number;
  duration: number;
  cooldown: number;
  knockback: number;
};
