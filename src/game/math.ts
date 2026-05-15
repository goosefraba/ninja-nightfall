export type Vec2 = {
  x: number;
  y: number;
};

export const vec2 = (x = 0, y = 0): Vec2 => ({ x, y });

export const cloneVec2 = (value: Vec2): Vec2 => ({ x: value.x, y: value.y });

export const lengthSq = (value: Vec2): number => value.x * value.x + value.y * value.y;

export const length = (value: Vec2): number => Math.sqrt(lengthSq(value));

export function normalize(value: Vec2): Vec2 {
  const magnitude = length(value);
  if (magnitude <= 0.00001) {
    return { x: 0, y: 0 };
  }
  return { x: value.x / magnitude, y: value.y / magnitude };
}

export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });

export const subtract = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });

export const multiply = (value: Vec2, scalar: number): Vec2 => ({
  x: value.x * scalar,
  y: value.y * scalar,
});

export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const lerp = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;

export const angleFromVec = (value: Vec2): number => Math.atan2(value.y, value.x);

export const vecFromAngle = (angle: number): Vec2 => ({
  x: Math.cos(angle),
  y: Math.sin(angle),
});

export const distance = (a: Vec2, b: Vec2): number => length(subtract(a, b));

export const randomRange = (min: number, max: number): number =>
  min + Math.random() * (max - min);

export const randomChoice = <T>(values: readonly T[]): T =>
  values[Math.floor(Math.random() * values.length)];

export function angleDelta(a: number, b: number): number {
  let delta = a - b;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

export function clampToArena(position: Vec2, halfWidth: number, halfHeight: number, margin: number): Vec2 {
  return {
    x: clamp(position.x, -halfWidth + margin, halfWidth - margin),
    y: clamp(position.y, -halfHeight + margin, halfHeight - margin),
  };
}
