const BLOCKED_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
  'KeyR',
  'KeyH',
  'KeyP',
  'Enter',
]);

const JOYSTICK_DEAD_ZONE = 0.14;
const JOYSTICK_DIRECTION_THRESHOLD = 0.34;
const JOYSTICK_SOURCE = 'touch-joystick';

type MovementVector = {
  x: number;
  y: number;
};

type TouchPointerBinding = {
  code: string;
  source: string;
};

export class InputController {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly released = new Set<string>();
  private readonly activeCodeSources = new Map<string, Set<string>>();
  private readonly touchButtons: HTMLButtonElement[] = [];
  private readonly activeTouchPointers = new Map<number, TouchPointerBinding>();
  private readonly joystick = document.querySelector<HTMLElement>('[data-touch-joystick]');
  private readonly joystickStick = document.querySelector<HTMLElement>('[data-touch-joystick-stick]');
  private readonly joystickCodes = new Set<string>();
  private activeJoystickPointer: number | undefined;
  private joystickVector: MovementVector = { x: 0, y: 0 };
  private hasInteracted = false;

  constructor(private readonly onFirstInteraction: () => void) {
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: false });
    window.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    this.bindTouchControls();
    this.bindJoystickControl();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointerdown', this.handlePointerDown);
    this.touchButtons.forEach((button) => {
      button.removeEventListener('pointerdown', this.handleTouchControlDown);
      button.removeEventListener('pointerup', this.handleTouchControlUp);
      button.removeEventListener('pointercancel', this.handleTouchControlUp);
      button.removeEventListener('lostpointercapture', this.handleTouchControlUp);
    });
    this.joystick?.removeEventListener('pointerdown', this.handleJoystickDown);
    this.joystick?.removeEventListener('pointermove', this.handleJoystickMove);
    this.joystick?.removeEventListener('pointerup', this.handleJoystickUp);
    this.joystick?.removeEventListener('pointercancel', this.handleJoystickUp);
    this.joystick?.removeEventListener('lostpointercapture', this.handleJoystickUp);
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  wasReleased(code: string): boolean {
    return this.released.has(code);
  }

  getMovementVector(): MovementVector {
    return { ...this.joystickVector };
  }

  flushFrame(): void {
    this.pressed.clear();
    this.released.clear();
  }

  private markInteracted(): void {
    if (this.hasInteracted) {
      return;
    }
    this.hasInteracted = true;
    this.onFirstInteraction();
  }

  private readonly handlePointerDown = (): void => {
    this.markInteracted();
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (BLOCKED_CODES.has(event.code)) {
      event.preventDefault();
    }
    this.markInteracted();
    this.pressCode(event.code, this.keyboardSource(event.code));
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (BLOCKED_CODES.has(event.code)) {
      event.preventDefault();
    }
    this.releaseCode(event.code, this.keyboardSource(event.code));
  };

  private bindTouchControls(): void {
    document.querySelectorAll<HTMLButtonElement>('[data-touch-code]').forEach((button) => {
      this.touchButtons.push(button);
      button.addEventListener('pointerdown', this.handleTouchControlDown, { passive: false });
      button.addEventListener('pointerup', this.handleTouchControlUp, { passive: false });
      button.addEventListener('pointercancel', this.handleTouchControlUp, { passive: false });
      button.addEventListener('lostpointercapture', this.handleTouchControlUp, { passive: false });
    });
  }

  private bindJoystickControl(): void {
    if (!this.joystick) {
      return;
    }

    this.joystick.addEventListener('pointerdown', this.handleJoystickDown, { passive: false });
    this.joystick.addEventListener('pointermove', this.handleJoystickMove, { passive: false });
    this.joystick.addEventListener('pointerup', this.handleJoystickUp, { passive: false });
    this.joystick.addEventListener('pointercancel', this.handleJoystickUp, { passive: false });
    this.joystick.addEventListener('lostpointercapture', this.handleJoystickUp, { passive: false });
  }

  private readonly handleTouchControlDown = (event: PointerEvent): void => {
    const code = this.codeFromTouchTarget(event.currentTarget);
    if (!code) {
      return;
    }

    event.preventDefault();
    this.markInteracted();
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Some synthetic pointer events cannot be captured.
      }
    }
    const source = this.touchSource(event.pointerId, code);
    this.activeTouchPointers.set(event.pointerId, { code, source });
    this.pressCode(code, source);
  };

  private readonly handleTouchControlUp = (event: PointerEvent): void => {
    const binding = this.activeTouchPointers.get(event.pointerId);
    const code = binding?.code ?? this.codeFromTouchTarget(event.currentTarget);
    if (!code) {
      return;
    }

    event.preventDefault();
    this.activeTouchPointers.delete(event.pointerId);
    this.releaseCode(code, binding?.source ?? this.touchSource(event.pointerId, code));
  };

  private readonly handleJoystickDown = (event: PointerEvent): void => {
    if (this.activeJoystickPointer !== undefined) {
      return;
    }

    event.preventDefault();
    this.markInteracted();
    this.activeJoystickPointer = event.pointerId;
    this.joystick?.setAttribute('data-active', 'true');

    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Some synthetic pointer events cannot be captured.
      }
    }

    this.updateJoystickFromPointer(event);
  };

  private readonly handleJoystickMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activeJoystickPointer) {
      return;
    }

    event.preventDefault();
    this.updateJoystickFromPointer(event);
  };

  private readonly handleJoystickUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activeJoystickPointer) {
      return;
    }

    event.preventDefault();
    this.activeJoystickPointer = undefined;
    this.joystickVector = { x: 0, y: 0 };
    this.releaseJoystickCodes();
    this.joystick?.setAttribute('data-active', 'false');
    this.setJoystickStickOffset(0, 0);
  };

  private codeFromTouchTarget(target: EventTarget | null): string | undefined {
    if (!(target instanceof HTMLElement)) {
      return undefined;
    }
    return target.dataset.touchCode;
  }

  private updateJoystickFromPointer(event: PointerEvent): void {
    if (!this.joystick) {
      return;
    }

    const rect = this.joystick.getBoundingClientRect();
    const radius = Math.max(24, Math.min(rect.width, rect.height) * 0.34);
    const centerX = rect.left + rect.width * 0.5;
    const centerY = rect.top + rect.height * 0.5;
    const rawX = event.clientX - centerX;
    const rawY = event.clientY - centerY;
    const distance = Math.hypot(rawX, rawY);
    const scale = distance > radius ? radius / distance : 1;
    const stickX = rawX * scale;
    const stickY = rawY * scale;
    const normalizedX = stickX / radius;
    const normalizedY = stickY / radius;

    this.setJoystickStickOffset(stickX, stickY);
    this.joystickVector =
      Math.hypot(normalizedX, normalizedY) < JOYSTICK_DEAD_ZONE
        ? { x: 0, y: 0 }
        : { x: normalizedX, y: normalizedY };
    this.updateJoystickCodes();
  }

  private updateJoystickCodes(): void {
    const nextCodes = new Set<string>();
    if (this.joystickVector.x <= -JOYSTICK_DIRECTION_THRESHOLD) {
      nextCodes.add('KeyA');
    }
    if (this.joystickVector.x >= JOYSTICK_DIRECTION_THRESHOLD) {
      nextCodes.add('KeyD');
    }
    if (this.joystickVector.y <= -JOYSTICK_DIRECTION_THRESHOLD) {
      nextCodes.add('KeyW');
    }
    if (this.joystickVector.y >= JOYSTICK_DIRECTION_THRESHOLD) {
      nextCodes.add('KeyS');
    }

    this.joystickCodes.forEach((code) => {
      if (!nextCodes.has(code)) {
        this.releaseCode(code, JOYSTICK_SOURCE);
      }
    });
    nextCodes.forEach((code) => {
      if (!this.joystickCodes.has(code)) {
        this.pressCode(code, JOYSTICK_SOURCE);
      }
    });

    this.joystickCodes.clear();
    nextCodes.forEach((code) => this.joystickCodes.add(code));
  }

  private releaseJoystickCodes(): void {
    this.joystickCodes.forEach((code) => this.releaseCode(code, JOYSTICK_SOURCE));
    this.joystickCodes.clear();
  }

  private setJoystickStickOffset(x: number, y: number): void {
    this.joystickStick?.style.setProperty('--stick-x', `${Math.round(x)}px`);
    this.joystickStick?.style.setProperty('--stick-y', `${Math.round(y)}px`);
  }

  private pressCode(code: string, source: string): void {
    let sources = this.activeCodeSources.get(code);
    if (!sources) {
      sources = new Set<string>();
      this.activeCodeSources.set(code, sources);
    }

    if (sources.has(source)) {
      return;
    }

    if (sources.size === 0 && !this.down.has(code)) {
      this.pressed.add(code);
    }
    sources.add(source);
    this.down.add(code);
  }

  private releaseCode(code: string, source: string): void {
    const sources = this.activeCodeSources.get(code);
    if (sources) {
      sources.delete(source);
      if (sources.size > 0) {
        return;
      }
      this.activeCodeSources.delete(code);
    }

    if (!this.down.has(code)) {
      return;
    }

    this.down.delete(code);
    this.released.add(code);
  }

  private keyboardSource(code: string): string {
    return `keyboard:${code}`;
  }

  private touchSource(pointerId: number, code: string): string {
    return `touch:${pointerId}:${code}`;
  }
}
