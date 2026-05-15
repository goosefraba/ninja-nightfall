import * as THREE from 'three';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BASE_SPAWN_INTERVAL,
  CAMERA_BASE_HEIGHT,
  CAMERA_ZOOM_PADDING,
  PLAYER_MAX_HEALTH,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  ULTIMATE_COOLDOWN,
  WAVE_BREAK_SECONDS,
  ZOMBIE_ANIMATION_RATE,
} from './constants';
import { loadGameAssets, type GameAssets } from './assets/GameAssets';
import { makeSpriteMaterial, scaleSpriteToTexture, textureAspect } from './assets/textureTools';
import { Player } from './entities/Player';
import { createZombie, resetZombieIds, zombieFramesFor } from './entities/ZombieFactory';
import { InputController } from './input/InputController';
import {
  add,
  angleDelta,
  angleFromVec,
  clamp,
  clampToArena,
  distance,
  dot,
  length,
  multiply,
  normalize,
  randomChoice,
  randomRange,
  subtract,
  vec2,
  vecFromAngle,
  type Vec2,
} from './math';
import { AudioSystem } from './systems/AudioSystem';
import { EffectsSystem } from './systems/EffectsSystem';
import { Hud } from './ui/Hud';
import type { AttackSpec, RunStats, WaveState, ZombieState } from './types';

declare global {
  interface Window {
    __ninjaNightfall?: {
      getState: () => Record<string, unknown>;
    };
  }
}

const ATTACKS: readonly AttackSpec[] = [
  {
    combo: 0,
    damage: 92,
    radius: 3.6,
    arcRadians: Math.PI * 0.42,
    duration: 0.22,
    cooldown: 0.08,
    knockback: 4.8,
  },
  {
    combo: 1,
    damage: 118,
    radius: 4.05,
    arcRadians: Math.PI * 0.52,
    duration: 0.24,
    cooldown: 0.09,
    knockback: 5.8,
  },
  {
    combo: 2,
    damage: 164,
    radius: 4.65,
    arcRadians: Math.PI * 0.62,
    duration: 0.3,
    cooldown: 0.18,
    knockback: 7.4,
  },
];

const HALF_WIDTH = ARENA_WIDTH / 2;
const HALF_HEIGHT = ARENA_HEIGHT / 2;

export class NinjaNightfallGame {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  private readonly clock = new THREE.Clock();
  private readonly audio = new AudioSystem();
  private readonly input = new InputController(() => this.audio.unlock());
  private readonly hud: Hud;
  private effects: EffectsSystem | undefined;
  private assets: GameAssets | undefined;
  private player: Player | undefined;
  private readonly zombies: ZombieState[] = [];
  private readonly stats: RunStats = { kills: 0, totalDamageTaken: 0 };
  private wave: WaveState = this.createInitialWave();
  private animationHandle = 0;
  private running = false;
  private lastDeathShown = false;
  private helpOpen = false;
  private hasShownFirstRunHelp = false;
  private ambientGroup = new THREE.Group();

  constructor(
    private readonly root: HTMLElement,
    private readonly viewport: HTMLElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x05080d, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.viewport.appendChild(this.renderer.domElement);

    const cracks = document.getElementById('screen-cracks');
    if (!(cracks instanceof HTMLCanvasElement)) {
      throw new Error('Missing screen crack canvas.');
    }
    this.effects = new EffectsSystem(this.scene, this.root, cracks);
    this.hud = new Hud(
      this.root,
      () => {
        void this.audio.toggleMusic();
      },
      (volume) => {
        this.audio.setMusicVolume(volume);
      },
      () => this.beginRun(),
      () => this.restart(),
      () => this.openHelp(),
      () => this.closeHelp(),
    );

    this.configureCamera();
    window.addEventListener('resize', this.handleResize);
  }

  async start(): Promise<void> {
    this.assets = await loadGameAssets();
    this.player = new Player(this.assets);
    this.buildArena(this.assets);
    this.scene.add(this.player.sprite);
    this.showMainMenu();
    this.running = true;
    this.clock.start();
    this.animationHandle = window.requestAnimationFrame(this.frame);
  }

  destroy(): void {
    this.running = false;
    window.cancelAnimationFrame(this.animationHandle);
    window.removeEventListener('resize', this.handleResize);
    this.input.destroy();
    this.effects?.destroy();
    this.renderer.dispose();
  }

  private restart(): void {
    if (!this.assets || !this.player) {
      return;
    }

    this.hud.hideMainMenu();
    this.zombies.forEach((zombie) => this.scene.remove(zombie.sprite));
    this.zombies.length = 0;
    resetZombieIds();
    this.stats.kills = 0;
    this.stats.totalDamageTaken = 0;
    this.wave = this.createInitialWave();
    this.player.reset();
    this.hud.hideDeath();
    this.closeHelp();
    this.lastDeathShown = false;
    this.root.dataset.phase = 'break';
    this.effects?.triggerSmash(0.35);
    this.effects?.spawnShockwave(this.player.state.position, 5.2, 0x9ceaff, 0.48);
    this.updateHud();
  }

  private showMainMenu(): void {
    if (!this.player) {
      return;
    }

    this.zombies.forEach((zombie) => this.scene.remove(zombie.sprite));
    this.zombies.length = 0;
    this.stats.kills = 0;
    this.stats.totalDamageTaken = 0;
    this.wave = this.createInitialWave();
    this.wave.phase = 'menu';
    this.wave.phaseTimer = 0;
    this.player.reset();
    this.player.state.invulnerability = 0;
    this.player.state.velocity = vec2(0, 0);
    this.hud.hideDeath();
    this.closeHelp();
    this.hud.showMainMenu();
    this.root.dataset.phase = 'menu';
    this.updateHud();
  }

  private beginRun(): void {
    this.restart();
    if (!this.hasShownFirstRunHelp) {
      this.hasShownFirstRunHelp = true;
      this.openHelp();
    }
  }

  private readonly frame = (): void => {
    if (!this.running) {
      return;
    }

    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    const hitStop = this.effects?.hitStop ?? 0;
    const simDt = hitStop > 0 ? rawDt * 0.08 : rawDt;

    this.update(simDt, rawDt);
    this.render();
    this.input.flushFrame();
    this.animationHandle = window.requestAnimationFrame(this.frame);
  };

  private update(dt: number, rawDt: number): void {
    if (!this.assets || !this.player || !this.effects) {
      return;
    }

    const helpWasOpen = this.helpOpen;
    this.handleHelpInput();
    if (this.helpOpen || helpWasOpen) {
      this.player.state.velocity = vec2(0, 0);
      this.updateHud();
      return;
    }

    this.effects.update(rawDt);

    if (this.wave.phase === 'menu') {
      this.player.state.velocity = vec2(0, 0);
      if (this.input.wasPressed('Enter')) {
        this.beginRun();
      }
      this.player.updateAnimation(rawDt);
      this.updateCamera(rawDt);
      this.updateHud();
      return;
    }

    if (this.player.state.isAlive) {
      this.updatePlayer(dt);
      this.updateWaves(dt);
      this.updateZombies(dt);
      this.resolveZombieContacts(dt);
    } else {
      this.wave.phase = 'dead';
      if (!this.lastDeathShown) {
        this.effects.triggerSmash(1.1);
        this.effects.addShake(2);
        this.effects.addDistortion(1);
        this.hud.showDeath(this.stats.kills);
        this.lastDeathShown = true;
      }
      if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
        this.restart();
      }
    }

    this.player.updateAnimation(rawDt);
    this.updateZombieAnimation(rawDt);
    this.updateCamera(rawDt);
    this.updateHud();
  }

  private updatePlayer(dt: number): void {
    if (!this.player || !this.effects) {
      return;
    }

    const state = this.player.state;
    const keyboardVector = vec2(
      (this.input.isDown('KeyD') ? 1 : 0) - (this.input.isDown('KeyA') ? 1 : 0),
      (this.input.isDown('KeyS') ? 1 : 0) - (this.input.isDown('KeyW') ? 1 : 0),
    );
    const joystickVector = this.input.getMovementVector();
    const inputVector = vec2(keyboardVector.x + joystickVector.x, keyboardVector.y + joystickVector.y);
    const inputStrength = clamp(length(inputVector), 0, 1);
    const direction = normalize(inputVector);
    state.velocity = multiply(direction, PLAYER_SPEED * inputStrength);
    state.position = clampToArena(
      add(state.position, multiply(state.velocity, dt)),
      HALF_WIDTH,
      HALF_HEIGHT,
      PLAYER_RADIUS,
    );

    if (inputStrength > 0.01) {
      state.facing = angleFromVec(direction);
    }

    state.attackTimer = Math.max(0, state.attackTimer - dt);
    state.attackCooldown = Math.max(0, state.attackCooldown - dt);
    state.comboWindow = Math.max(0, state.comboWindow - dt);
    state.ultimateCooldown = Math.max(0, state.ultimateCooldown - dt);
    state.invulnerability = Math.max(0, state.invulnerability - dt);

    if (this.input.wasPressed('Space') && state.attackCooldown <= 0) {
      this.startAttack();
    }

    if (this.input.wasPressed('KeyR') && state.ultimateCooldown <= 0) {
      this.fireUltimate();
    }

    if (state.attackTimer > 0) {
      this.resolveSwordAttack();
    }

    this.player.syncSprite();
  }

  private handleHelpInput(): void {
    if (this.input.wasPressed('KeyH') || this.input.wasPressed('KeyP')) {
      this.toggleHelp();
      return;
    }

    if (this.helpOpen && (this.input.wasPressed('Escape') || this.input.wasPressed('Enter'))) {
      this.closeHelp();
    }
  }

  private toggleHelp(): void {
    if (this.helpOpen) {
      this.closeHelp();
    } else {
      this.openHelp();
    }
  }

  private openHelp(): void {
    this.helpOpen = true;
    this.hud.showHelp();
    this.updateHud();
  }

  private closeHelp(): void {
    this.helpOpen = false;
    this.hud.hideHelp();
    this.updateHud();
  }

  private startAttack(): void {
    if (!this.player || !this.effects) {
      return;
    }

    const state = this.player.state;
    const nextCombo = state.comboWindow > 0 ? (state.comboIndex + 1) % ATTACKS.length : 0;
    const attack = ATTACKS[nextCombo];
    state.comboIndex = nextCombo;
    state.attackTimer = attack.duration;
    state.attackDuration = attack.duration;
    state.attackCooldown = attack.cooldown;
    state.comboWindow = 0.58;
    state.hitIds.clear();
    this.audio.playSlash(nextCombo);
    this.effects.spawnSlash(state.position, state.facing, nextCombo);
    this.effects.spawnShockwave(state.position, 2.8 + nextCombo * 0.55, nextCombo === 2 ? 0xe8fbff : 0x8eeeff, 0.36);
    this.effects.spawnParticles(state.position, 18 + nextCombo * 8, [0xf8fdff, 0x8eeeff, 0x4bbdff], 0.65, state.facing);
    this.effects.addShake(0.18 + nextCombo * 0.08);
    this.effects.addDistortion(0.15 + nextCombo * 0.06);
  }

  private resolveSwordAttack(): void {
    if (!this.player || !this.effects || !this.assets) {
      return;
    }

    const state = this.player.state;
    const attack = ATTACKS[state.comboIndex];
    const facing = vecFromAngle(state.facing);
    let hitCount = 0;

    for (const zombie of this.zombies) {
      if (state.hitIds.has(zombie.id) || zombie.health <= 0) {
        continue;
      }
      const toZombie = subtract(zombie.position, state.position);
      const range = length(toZombie);
      if (range > attack.radius + zombie.radius) {
        continue;
      }
      const direction = normalize(toZombie);
      const angle = Math.acos(clamp(dot(facing, direction), -1, 1));
      if (angle > attack.arcRadians * 0.5) {
        continue;
      }

      state.hitIds.add(zombie.id);
      this.damageZombie(zombie, attack.damage, attack.knockback, state.facing);
      hitCount += 1;
    }

    if (hitCount > 0) {
      this.effects.triggerHitStop(0.045 + Math.min(0.05, hitCount * 0.012));
      this.effects.addShake(0.36 + Math.min(0.42, hitCount * 0.08));
      this.effects.addDistortion(0.32);
      this.effects.triggerSmash(Math.min(0.55, 0.18 + hitCount * 0.06));
    }
  }

  private fireUltimate(): void {
    if (!this.player || !this.effects || !this.assets) {
      return;
    }

    const state = this.player.state;
    state.ultimateCooldown = ULTIMATE_COOLDOWN;
    state.attackTimer = 0.44;
    state.attackDuration = 0.44;
    state.comboIndex = 2;
    state.hitIds.clear();

    this.audio.playUltimate();
    this.effects.triggerHitStop(0.12);
    this.effects.addShake(1.8);
    this.effects.addDistortion(1.2);
    this.effects.triggerSmash(1.15);
    this.effects.spawnShockwave(state.position, 8.4, 0xe8fbff, 0.86);
    this.effects.spawnShockwave(state.position, 5.4, 0x73dfff, 0.54);
    this.effects.spawnSlash(state.position, state.facing, 2);
    this.effects.spawnSlash(state.position, state.facing + Math.PI, 2);
    this.effects.spawnParticles(state.position, 130, [0xf8fdff, 0xa9efff, 0x65c6ff, 0xffd08f], 1.55);
    this.effects.spawnCrackDecal(state.position, randomChoice(this.assets.environment.cracks), 3.8);

    for (const zombie of this.zombies) {
      const range = distance(zombie.position, state.position);
      if (range <= 10.2) {
        const direction = angleFromVec(subtract(zombie.position, state.position));
        const damage = range < 6.2 ? 360 : 230;
        this.damageZombie(zombie, damage, 10.5, direction);
      }
    }
  }

  private damageZombie(zombie: ZombieState, amount: number, knockback: number, angle: number): void {
    if (!this.effects || !this.assets) {
      return;
    }
    zombie.health -= amount;
    zombie.stagger = Math.max(zombie.stagger, 0.18);
    const knockbackDirection = vecFromAngle(angle);
    zombie.knockback = add(zombie.knockback, multiply(knockbackDirection, knockback));

    this.audio.playHit();
    this.effects.spawnParticles(zombie.position, 16, [0xc7fff8, 0xffffff, 0xff5d49, 0x29313a], 1.0, angle);
    this.effects.spawnShockwave(zombie.position, 1.15, 0xf6fbff, 0.22);

    if (zombie.health <= 0) {
      this.killZombie(zombie);
    }
  }

  private killZombie(zombie: ZombieState): void {
    if (!this.effects || !this.assets) {
      return;
    }

    this.stats.kills += 1;
    this.effects.spawnParticles(zombie.position, 30, [0xe8ffff, 0x96d6ff, 0xff503f, 0x10151d], 1.3);
    this.effects.spawnCrackDecal(zombie.position, randomChoice(this.assets.environment.cracks), randomRange(1.1, 1.8));
    const material = zombie.sprite.material as THREE.SpriteMaterial;
    material.map = randomChoice(this.assets.zombie.dead);
    material.opacity = 0.82;
    material.rotation = 0;
    zombie.sprite.scale.multiplyScalar(1.08);
    zombie.sprite.renderOrder = 7;
    zombie.attackCooldown = 999;
  }

  private updateWaves(dt: number): void {
    if (!this.assets) {
      return;
    }

    if (this.wave.phase === 'break') {
      this.wave.phaseTimer -= dt;
      if (this.wave.phaseTimer <= 0) {
        this.wave.phase = 'active';
        this.wave.spawnTimer = 0;
        this.wave.spawnedThisWave = 0;
        this.wave.targetThisWave = 4 + this.wave.wave * 3;
      }
      return;
    }

    if (this.wave.phase !== 'active') {
      return;
    }

    this.wave.spawnTimer -= dt;
    const spawnInterval = Math.max(0.24, BASE_SPAWN_INTERVAL - this.wave.wave * 0.025);
    if (this.wave.spawnedThisWave < this.wave.targetThisWave && this.wave.spawnTimer <= 0) {
      const pack = this.wave.wave > 5 && Math.random() > 0.68 ? 2 : 1;
      for (let index = 0; index < pack; index += 1) {
        this.spawnZombie();
      }
      this.wave.spawnedThisWave += pack;
      this.wave.spawnTimer = spawnInterval;
    }

    const living = this.zombies.filter((zombie) => zombie.health > 0).length;
    if (this.wave.spawnedThisWave >= this.wave.targetThisWave && living === 0) {
      this.wave.wave += 1;
      this.wave.phase = 'break';
      this.wave.phaseTimer = Math.max(1.8, WAVE_BREAK_SECONDS - this.wave.wave * 0.05);
      this.wave.spawnedThisWave = 0;
      this.wave.targetThisWave = 4 + this.wave.wave * 3;
      this.effects?.spawnShockwave(this.player?.state.position ?? vec2(0, 0), 5, 0x9ff4ff, 0.42);
    }
  }

  private spawnZombie(): void {
    if (!this.assets || !this.player) {
      return;
    }

    const side = Math.floor(Math.random() * 4);
    const overshoot = 1.3;
    const position =
      side === 0
        ? vec2(randomRange(-HALF_WIDTH, HALF_WIDTH), -HALF_HEIGHT - overshoot)
        : side === 1
          ? vec2(randomRange(-HALF_WIDTH, HALF_WIDTH), HALF_HEIGHT + overshoot)
          : side === 2
            ? vec2(-HALF_WIDTH - overshoot, randomRange(-HALF_HEIGHT, HALF_HEIGHT))
            : vec2(HALF_WIDTH + overshoot, randomRange(-HALF_HEIGHT, HALF_HEIGHT));

    const zombie = createZombie(this.assets, position, this.wave.wave);
    this.zombies.push(zombie);
    this.scene.add(zombie.sprite);
  }

  private updateZombies(dt: number): void {
    if (!this.player) {
      return;
    }

    const playerPosition = this.player.state.position;
    for (let index = this.zombies.length - 1; index >= 0; index -= 1) {
      const zombie = this.zombies[index];
      if (zombie.health <= 0) {
        const material = zombie.sprite.material as THREE.SpriteMaterial;
        material.opacity -= dt * 0.12;
        if (material.opacity <= 0.08) {
          this.scene.remove(zombie.sprite);
          this.zombies.splice(index, 1);
        }
        continue;
      }

      zombie.attackCooldown = Math.max(0, zombie.attackCooldown - dt);
      zombie.stagger = Math.max(0, zombie.stagger - dt);
      const toPlayer = subtract(playerPosition, zombie.position);
      const direction = normalize(toPlayer);
      const avoid = this.computeAvoidance(zombie);
      const desired = normalize(add(direction, multiply(avoid, 0.72)));
      const speed = zombie.stagger > 0 ? zombie.speed * 0.26 : zombie.speed;
      zombie.velocity = multiply(desired, speed);
      zombie.position = add(zombie.position, multiply(zombie.velocity, dt));
      zombie.position = add(zombie.position, multiply(zombie.knockback, dt));
      zombie.knockback = multiply(zombie.knockback, Math.max(0, 1 - dt * 8));
      zombie.sprite.position.set(zombie.position.x, 0.62, zombie.position.y);

      const material = zombie.sprite.material as THREE.SpriteMaterial;
      material.rotation = 0;
      material.opacity = zombie.stagger > 0 ? 0.78 : 1;
      const horizontalFacing = direction.x;
      const sign = horizontalFacing < -0.08 ? -1 : 1;
      zombie.sprite.userData.facingSign = sign;
      this.scaleZombieSprite(zombie);
    }
  }

  private computeAvoidance(source: ZombieState): Vec2 {
    const avoid = vec2(0, 0);
    for (const other of this.zombies) {
      if (other === source || other.health <= 0) {
        continue;
      }
      const delta = subtract(source.position, other.position);
      const dist = length(delta);
      if (dist > 0.001 && dist < 1.2) {
        const push = multiply(normalize(delta), (1.2 - dist) / 1.2);
        avoid.x += push.x;
        avoid.y += push.y;
      }
    }
    return avoid;
  }

  private resolveZombieContacts(dt: number): void {
    if (!this.player || !this.effects) {
      return;
    }

    for (const zombie of this.zombies) {
      if (zombie.health <= 0) {
        continue;
      }
      const range = distance(zombie.position, this.player.state.position);
      if (range <= zombie.radius + PLAYER_RADIUS && zombie.attackCooldown <= 0) {
        const damaged = this.player.takeDamage(zombie.damage);
        zombie.attackCooldown = 0.72;
        const away = normalize(subtract(zombie.position, this.player.state.position));
        zombie.knockback = add(zombie.knockback, multiply(away, 3.2));
        if (damaged) {
          this.stats.totalDamageTaken += zombie.damage;
          this.audio.playPlayerHurt();
          this.effects.addShake(0.72);
          this.effects.addDistortion(0.44);
          this.effects.triggerSmash(0.42);
          this.effects.spawnParticles(this.player.state.position, 24, [0xff523f, 0xffd18c, 0xffffff], 1.2);
        }
      }
    }

    this.player.state.health = clamp(this.player.state.health, 0, PLAYER_MAX_HEALTH);
    if (!this.player.state.isAlive) {
      this.wave.phase = 'dead';
    }
    void dt;
  }

  private updateZombieAnimation(dt: number): void {
    if (!this.assets) {
      return;
    }

    for (const zombie of this.zombies) {
      if (zombie.health <= 0) {
        continue;
      }
      zombie.animTime += dt;
      const frames = zombieFramesFor(this.assets, zombie);
      const frame = Math.floor(zombie.animTime / ZOMBIE_ANIMATION_RATE) % frames.length;
      const material = zombie.sprite.material as THREE.SpriteMaterial;
      material.map = frames[frame];
      material.needsUpdate = true;
      this.scaleZombieSprite(zombie);
    }
  }

  private updateCamera(dt: number): void {
    if (!this.player || !this.effects) {
      return;
    }

    const offset = this.effects.cameraOffset();
    const targetX = this.player.state.position.x * 0.16 + offset.x;
    const targetZ = this.player.state.position.y * 0.16 + offset.y;
    this.camera.position.x += (targetX - this.camera.position.x) * Math.min(1, dt * 7.5);
    this.camera.position.z += (targetZ - this.camera.position.z) * Math.min(1, dt * 7.5);
    this.camera.lookAt(this.camera.position.x, 0, this.camera.position.z);
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private updateHud(): void {
    if (!this.player) {
      return;
    }

    this.hud.update({
      wave: this.wave.wave,
      kills: this.stats.kills,
      health: this.player.state.health,
      ultimateCooldown: this.player.state.ultimateCooldown,
      phase: this.wave.phase,
      phaseTimer: this.wave.phaseTimer,
      musicEnabled: this.audio.enabled,
      zombieCount: this.zombies.filter((zombie) => zombie.health > 0).length,
      playerX: this.player.state.position.x,
      playerY: this.player.state.position.y,
      combo: this.player.state.comboIndex,
      attacking: this.player.state.attackTimer > 0,
      musicVolume: this.audio.musicVolume,
      helpOpen: this.helpOpen,
      paused: this.isPaused(),
    });

    window.__ninjaNightfall = {
      getState: () => ({
        wave: this.wave.wave,
        kills: this.stats.kills,
        health: Math.ceil(this.player?.state.health ?? 0),
        ultimateCooldown: Number((this.player?.state.ultimateCooldown ?? 0).toFixed(2)),
        phase: this.wave.phase,
        zombies: this.zombies.filter((zombie) => zombie.health > 0).length,
        playerX: Number((this.player?.state.position.x ?? 0).toFixed(2)),
        playerY: Number((this.player?.state.position.y ?? 0).toFixed(2)),
        combo: this.player?.state.comboIndex ?? 0,
        attacking: (this.player?.state.attackTimer ?? 0) > 0,
        musicEnabled: this.audio.enabled,
        musicVolume: Number(this.audio.musicVolume.toFixed(2)),
        helpOpen: this.helpOpen,
        paused: this.isPaused(),
        phaseTimer: Number(this.wave.phaseTimer.toFixed(2)),
      }),
    };
  }

  private isPaused(): boolean {
    return this.helpOpen && this.wave.phase !== 'menu' && this.wave.phase !== 'dead';
  }

  private buildArena(assets: GameAssets): void {
    this.scene.clear();
    this.ambientGroup = new THREE.Group();
    this.scene.add(this.ambientGroup);

    this.addSceneryBackground(assets);
    this.addLightingGlows();
  }

  private scaleZombieSprite(zombie: ZombieState): void {
    const baseHeight = Number(zombie.sprite.userData.baseHeight ?? 1.7);
    const facingSign = Number(zombie.sprite.userData.facingSign ?? 1);
    scaleSpriteToTexture(zombie.sprite, baseHeight, facingSign);
  }

  private addSceneryBackground(assets: GameAssets): void {
    const backgroundHeight = ARENA_HEIGHT + 5.6;
    const backgroundWidth = backgroundHeight * textureAspect(assets.source.arenaScenery);
    const backgroundGeometry = new THREE.PlaneGeometry(backgroundWidth, backgroundHeight);
    backgroundGeometry.rotateX(-Math.PI * 0.5);
    const background = new THREE.Mesh(
      backgroundGeometry,
      new THREE.MeshBasicMaterial({
        map: assets.source.arenaScenery,
        color: 0xffffff,
        depthWrite: true,
      }),
    );
    background.position.y = -0.035;
    background.renderOrder = 0;
    this.scene.add(background);
  }

  private addReferenceBackdrops(assets: GameAssets): void {
    const bridgeMaterial = new THREE.MeshBasicMaterial({
      map: assets.source.approvedBridgeUltimate,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const nightMaterial = new THREE.MeshBasicMaterial({
      map: assets.source.approvedCombatNight,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    });
    const bridge = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), bridgeMaterial);
    bridge.rotation.x = -Math.PI * 0.5;
    bridge.position.set(0, 0.01, -11.7);
    bridge.renderOrder = 1;
    const night = new THREE.Mesh(new THREE.PlaneGeometry(18, 12), nightMaterial);
    night.rotation.x = -Math.PI * 0.5;
    night.position.set(0, 0.012, 11.6);
    night.renderOrder = 1;
    this.scene.add(bridge, night);
  }

  private addStoneFloor(assets: GameAssets): void {
    const tileGeometry = new THREE.PlaneGeometry(2, 2);
    tileGeometry.rotateX(-Math.PI * 0.5);
    const tileMaterials = assets.environment.tiles.map(
      (texture) =>
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          opacity: 0.96,
          depthWrite: true,
        }),
    );

    for (let x = -HALF_WIDTH + 1; x < HALF_WIDTH; x += 2) {
      for (let y = -HALF_HEIGHT + 1; y < HALF_HEIGHT; y += 2) {
        const material = randomChoice(tileMaterials);
        const tile = new THREE.Mesh(tileGeometry, material);
        tile.position.set(x + randomRange(-0.08, 0.08), 0, y + randomRange(-0.08, 0.08));
        tile.rotation.z = Math.floor(Math.random() * 4) * (Math.PI * 0.5);
        tile.renderOrder = 2;
        this.scene.add(tile);
      }
    }

    const edgeMaterial = new THREE.MeshBasicMaterial({
      color: 0x08111a,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    });
    const topEdge = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_WIDTH + 2, 3.2), edgeMaterial);
    topEdge.rotation.x = -Math.PI * 0.5;
    topEdge.position.set(0, 0.02, -HALF_HEIGHT - 1.1);
    const bottomEdge = topEdge.clone();
    bottomEdge.position.z = HALF_HEIGHT + 1.1;
    const leftEdge = new THREE.Mesh(new THREE.PlaneGeometry(3.2, ARENA_HEIGHT + 2), edgeMaterial.clone());
    leftEdge.rotation.x = -Math.PI * 0.5;
    leftEdge.position.set(-HALF_WIDTH - 1.1, 0.02, 0);
    const rightEdge = leftEdge.clone();
    rightEdge.position.x = HALF_WIDTH + 1.1;
    this.scene.add(topEdge, bottomEdge, leftEdge, rightEdge);
  }

  private addDecorations(assets: GameAssets): void {
    const decorationSprite = (texture: THREE.Texture, x: number, y: number, scale: number, order = 10) => {
      const sprite = new THREE.Sprite(makeSpriteMaterial(texture, 0.96));
      sprite.position.set(x, 0.36, y);
      sprite.scale.set(scale, scale, 1);
      sprite.renderOrder = order;
      this.ambientGroup.add(sprite);
      return sprite;
    };

    [-16, -7, 8, 16].forEach((x, index) => {
      decorationSprite(randomChoice(assets.environment.lanterns), x, -11.5 + (index % 2) * 1.2, 1.7, 14);
      decorationSprite(randomChoice(assets.environment.lanterns), -x, 11.5 - (index % 2) * 1.1, 1.55, 14);
    });

    decorationSprite(assets.environment.torii[0], -15.6, -8.3, 3.5, 11);
    decorationSprite(assets.environment.torii[1], 15.2, 8.2, 3.2, 11);
    decorationSprite(assets.environment.torii[2], 13.5, -9.2, 2.6, 11);

    for (let i = 0; i < 18; i += 1) {
      const x = randomChoice([-1, 1]) * randomRange(18, 23);
      const y = randomRange(-13, 13);
      decorationSprite(randomChoice(assets.environment.bamboo), x, y, randomRange(2.0, 3.2), 9);
    }

    for (let i = 0; i < 24; i += 1) {
      const leaf = decorationSprite(
        randomChoice(assets.environment.leaves),
        randomRange(-18, 18),
        randomRange(-12, 12),
        randomRange(0.8, 1.4),
        5,
      );
      const material = leaf.material as THREE.SpriteMaterial;
      material.opacity = randomRange(0.48, 0.82);
      material.rotation = randomRange(0, Math.PI * 2);
    }
  }

  private addLightingGlows(): void {
    const glowGeometry = new THREE.CircleGeometry(1, 28);
    glowGeometry.rotateX(-Math.PI * 0.5);
    const warmGlow = createGlowTexture('#ffad49');
    const blueGlow = createGlowTexture('#6dcfff');
    const positions = [
      vec2(-16, -10.6),
      vec2(16, 10.4),
      vec2(-14, 10.8),
      vec2(12.8, -9.6),
      vec2(0, 0),
    ];
    for (const position of positions) {
      const glow = new THREE.Mesh(
        glowGeometry,
        new THREE.MeshBasicMaterial({
          map: position.x === 0 && position.y === 0 ? blueGlow : warmGlow,
          transparent: true,
          opacity: position.x === 0 && position.y === 0 ? 0.28 : 0.46,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.position.set(position.x, 0.025, position.y);
      glow.scale.setScalar(position.x === 0 && position.y === 0 ? 4.7 : 2.15);
      glow.renderOrder = 3;
      this.scene.add(glow);
    }
  }

  private configureCamera(): void {
    this.camera.position.set(0, CAMERA_BASE_HEIGHT, 0);
    this.camera.up.set(0, 0, -1);
    this.camera.lookAt(0, 0, 0);
    this.handleResize();
  }

  private readonly handleResize = (): void => {
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    const aspect = width / height;
    const vertical = ARENA_HEIGHT * CAMERA_ZOOM_PADDING;
    const horizontal = vertical * aspect;
    this.camera.left = -horizontal / 2;
    this.camera.right = horizontal / 2;
    this.camera.top = vertical / 2;
    this.camera.bottom = -vertical / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private createInitialWave(): WaveState {
    return {
      wave: 1,
      phase: 'break',
      phaseTimer: 4.0,
      spawnTimer: 0,
      spawnedThisWave: 0,
      targetThisWave: 7,
    };
  }
}

function createGlowTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create glow texture.');
  }
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.22, color);
  gradient.addColorStop(0.58, 'rgba(255, 255, 255, 0.08)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
