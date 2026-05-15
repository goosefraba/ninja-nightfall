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

export class InputController {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();
  private readonly released = new Set<string>();
  private readonly touchButtons: HTMLButtonElement[] = [];
  private readonly activeTouchPointers = new Map<number, string>();
  private hasInteracted = false;

  constructor(private readonly onFirstInteraction: () => void) {
    window.addEventListener('keydown', this.handleKeyDown, { passive: false });
    window.addEventListener('keyup', this.handleKeyUp, { passive: false });
    window.addEventListener('pointerdown', this.handlePointerDown, { passive: true });
    this.bindTouchControls();
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
    this.pressCode(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (BLOCKED_CODES.has(event.code)) {
      event.preventDefault();
    }
    this.releaseCode(event.code);
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

  private readonly handleTouchControlDown = (event: PointerEvent): void => {
    const code = this.codeFromTouchTarget(event.currentTarget);
    if (!code) {
      return;
    }

    event.preventDefault();
    this.markInteracted();
    this.activeTouchPointers.set(event.pointerId, code);
    const target = event.currentTarget;
    if (target instanceof HTMLElement) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Some synthetic pointer events cannot be captured.
      }
    }
    this.pressCode(code);
  };

  private readonly handleTouchControlUp = (event: PointerEvent): void => {
    const code = this.activeTouchPointers.get(event.pointerId) ?? this.codeFromTouchTarget(event.currentTarget);
    if (!code) {
      return;
    }

    event.preventDefault();
    this.activeTouchPointers.delete(event.pointerId);
    this.releaseCode(code);
  };

  private codeFromTouchTarget(target: EventTarget | null): string | undefined {
    if (!(target instanceof HTMLElement)) {
      return undefined;
    }
    return target.dataset.touchCode;
  }

  private pressCode(code: string): void {
    if (!this.down.has(code)) {
      this.pressed.add(code);
    }
    this.down.add(code);
  }

  private releaseCode(code: string): void {
    this.down.delete(code);
    this.released.add(code);
  }
}
