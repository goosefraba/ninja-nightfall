import { PLAYER_MAX_HEALTH, ULTIMATE_COOLDOWN } from '../constants';
import type { GamePhase } from '../types';

type HudUpdate = {
  wave: number;
  kills: number;
  health: number;
  ultimateCooldown: number;
  phase: GamePhase;
  phaseTimer: number;
  musicEnabled: boolean;
  zombieCount: number;
  playerX: number;
  playerY: number;
  combo: number;
  attacking: boolean;
  musicVolume: number;
  helpOpen: boolean;
  paused: boolean;
};

export class Hud {
  private readonly waveValue = requiredElement<HTMLElement>('wave-value');
  private readonly killsValue = requiredElement<HTMLElement>('kills-value');
  private readonly healthValue = requiredElement<HTMLElement>('health-value');
  private readonly healthFill = requiredElement<HTMLElement>('health-fill');
  private readonly ultimateStatus = requiredElement<HTMLElement>('ultimate-status');
  private readonly musicToggle = requiredElement<HTMLButtonElement>('music-toggle');
  private readonly menuMusicToggle = requiredElement<HTMLButtonElement>('menu-music-toggle');
  private readonly menuMusicVolume = requiredElement<HTMLInputElement>('menu-music-volume');
  private readonly menuMusicVolumeValue = requiredElement<HTMLElement>('menu-music-volume-value');
  private readonly waveBanner = requiredElement<HTMLElement>('wave-banner');
  private readonly mainMenu = requiredElement<HTMLElement>('main-menu');
  private readonly startRunButton = requiredElement<HTMLButtonElement>('start-run-button');
  private readonly menuHelpButton = requiredElement<HTMLButtonElement>('menu-help-button');
  private readonly helpButton = requiredElement<HTMLButtonElement>('help-button');
  private readonly helpMenu = requiredElement<HTMLElement>('help-menu');
  private readonly closeHelpButton = requiredElement<HTMLButtonElement>('close-help-button');
  private readonly deathScreen = requiredElement<HTMLElement>('death-screen');
  private readonly deathKills = requiredElement<HTMLElement>('death-kills');
  private readonly restartButton = requiredElement<HTMLButtonElement>('restart-button');
  private readonly debugState = requiredElement<HTMLElement>('debug-state');

  constructor(
    private readonly root: HTMLElement,
    onToggleMusic: () => void,
    onSetMusicVolume: (volume: number) => void,
    onStartRun: () => void,
    onRestart: () => void,
    onOpenHelp: () => void,
    onCloseHelp: () => void,
  ) {
    this.musicToggle.addEventListener('click', onToggleMusic);
    this.menuMusicToggle.addEventListener('click', onToggleMusic);
    this.menuMusicVolume.addEventListener('input', () => {
      onSetMusicVolume(Number(this.menuMusicVolume.value) / 100);
    });
    this.startRunButton.addEventListener('click', onStartRun);
    this.menuHelpButton.addEventListener('click', onOpenHelp);
    this.helpButton.addEventListener('click', onOpenHelp);
    this.restartButton.addEventListener('click', onRestart);
    this.closeHelpButton.addEventListener('click', onCloseHelp);
  }

  update(data: HudUpdate): void {
    this.root.dataset.phase = data.phase;
    this.root.dataset.helpOpen = String(data.helpOpen);
    this.root.dataset.paused = String(data.paused);
    this.waveValue.textContent = String(data.wave);
    this.killsValue.textContent = String(data.kills);
    this.healthValue.textContent = String(Math.ceil(data.health));
    this.healthFill.style.transform = `scaleX(${Math.max(0, data.health / PLAYER_MAX_HEALTH).toFixed(3)})`;

    if (data.ultimateCooldown <= 0) {
      this.ultimateStatus.textContent = 'Ultimate Ready';
      this.ultimateStatus.classList.remove('is-cooling');
    } else {
      const progress = 1 - data.ultimateCooldown / ULTIMATE_COOLDOWN;
      this.ultimateStatus.textContent = `Ultimate ${Math.ceil(data.ultimateCooldown)}s`;
      this.ultimateStatus.style.background = `linear-gradient(90deg, rgba(92, 190, 255, 0.36) ${Math.round(
        progress * 100,
      )}%, rgba(7, 13, 23, 0.72) ${Math.round(progress * 100)}%)`;
      this.ultimateStatus.classList.add('is-cooling');
    }

    if (data.ultimateCooldown <= 0) {
      this.ultimateStatus.style.background = '';
    }

    this.musicToggle.textContent = data.musicEnabled ? 'Music On' : 'Music Off';
    this.musicToggle.setAttribute('aria-pressed', String(data.musicEnabled));
    this.menuMusicToggle.textContent = data.musicEnabled ? 'Music On' : 'Music Off';
    this.menuMusicToggle.setAttribute('aria-pressed', String(data.musicEnabled));
    this.menuMusicVolume.value = String(Math.round(data.musicVolume * 100));
    this.menuMusicVolumeValue.textContent = `${Math.round(data.musicVolume * 100)}%`;

    if (data.phase === 'menu') {
      this.waveBanner.textContent = 'Awaiting the first run';
    } else if (data.phase === 'break') {
      this.waveBanner.textContent =
        data.wave === 1
          ? 'Nightfall begins'
          : `Wave ${data.wave} incoming in ${Math.max(1, Math.ceil(data.phaseTimer))}`;
    } else if (data.phase === 'active') {
      this.waveBanner.textContent = `Wave ${data.wave} - ${data.zombieCount} closing in`;
    } else if (data.phase === 'dead') {
      this.waveBanner.textContent = 'The shrine is overrun';
    }

    this.debugState.textContent = JSON.stringify({
      wave: data.wave,
      kills: data.kills,
      health: Math.ceil(data.health),
      ultimateCooldown: Number(data.ultimateCooldown.toFixed(2)),
      phase: data.phase,
      zombieCount: data.zombieCount,
      playerX: Number(data.playerX.toFixed(2)),
      playerY: Number(data.playerY.toFixed(2)),
      combo: data.combo,
      attacking: data.attacking,
      musicEnabled: data.musicEnabled,
      musicVolume: Number(data.musicVolume.toFixed(2)),
      helpOpen: data.helpOpen,
      paused: data.paused,
    });
  }

  showDeath(kills: number): void {
    this.deathKills.textContent = `${kills} zombies defeated`;
    this.deathScreen.hidden = false;
  }

  hideDeath(): void {
    this.deathScreen.hidden = true;
  }

  showMainMenu(): void {
    this.mainMenu.hidden = false;
  }

  hideMainMenu(): void {
    this.mainMenu.hidden = true;
  }

  showHelp(): void {
    this.helpMenu.hidden = false;
  }

  hideHelp(): void {
    this.helpMenu.hidden = true;
  }
}

function requiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing HUD element #${id}`);
  }
  return element as T;
}
