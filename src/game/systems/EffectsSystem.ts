import * as THREE from 'three';
import { randomRange, vec2, vecFromAngle, type Vec2 } from '../math';

type TimedMesh = {
  mesh: THREE.Object3D;
  ttl: number;
  age: number;
  startScale: number;
  endScale: number;
  startOpacity: number;
  spin: number;
  velocity: Vec2;
};

type CrackLine = {
  x: number;
  y: number;
  points: Array<{ x: number; y: number }>;
  alpha: number;
};

const particleGeometry = new THREE.PlaneGeometry(1, 1);

export class EffectsSystem {
  hitStop = 0;
  private shake = 0;
  private distortion = 0;
  private smash = 0;
  private readonly timed: TimedMesh[] = [];
  private readonly cracks: CrackLine[] = [];
  private readonly crackContext: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly root: HTMLElement,
    private readonly crackCanvas: HTMLCanvasElement,
  ) {
    const context = crackCanvas.getContext('2d');
    if (!context) {
      throw new Error('Could not create screen crack canvas context.');
    }
    this.crackContext = context;
    this.resizeCanvas();
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(root);
  }

  destroy(): void {
    this.resizeObserver.disconnect();
    this.timed.forEach((item) => this.scene.remove(item.mesh));
    this.timed.length = 0;
  }

  update(dt: number): void {
    this.hitStop = Math.max(0, this.hitStop - dt);
    this.shake = Math.max(0, this.shake - dt * 9);
    this.distortion = Math.max(0, this.distortion - dt * 5.6);
    this.smash = Math.max(0, this.smash - dt * 1.8);

    this.root.classList.toggle('is-distorting', this.distortion > 0.02);

    for (let index = this.timed.length - 1; index >= 0; index -= 1) {
      const item = this.timed[index];
      item.age += dt;
      const t = Math.min(1, item.age / item.ttl);
      const scale = item.startScale + (item.endScale - item.startScale) * easeOutCubic(t);
      item.mesh.scale.setScalar(scale);
      item.mesh.position.x += item.velocity.x * dt;
      item.mesh.position.z += item.velocity.y * dt;
      item.mesh.rotation.y += item.spin * dt;

      const material = materialOf(item.mesh);
      if (material) {
        material.opacity = item.startOpacity * (1 - t);
      }

      if (t >= 1) {
        this.scene.remove(item.mesh);
        disposeObject(item.mesh);
        this.timed.splice(index, 1);
      }
    }

    this.drawScreenCracks();
  }

  triggerHitStop(seconds: number): void {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  addShake(amount: number): void {
    this.shake = Math.min(2.6, this.shake + amount);
  }

  addDistortion(amount: number): void {
    this.distortion = Math.min(1.5, this.distortion + amount);
  }

  triggerSmash(intensity: number): void {
    this.smash = Math.min(1.4, this.smash + intensity);
    const width = this.crackCanvas.width;
    const height = this.crackCanvas.height;
    const centerX = width * randomRange(0.38, 0.62);
    const centerY = height * randomRange(0.34, 0.62);
    const count = Math.floor(10 + intensity * 12);
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + randomRange(-0.14, 0.14);
      const length = randomRange(90, 320) * intensity;
      const segments = Math.floor(randomRange(3, 7));
      const points = [{ x: centerX, y: centerY }];
      for (let segment = 1; segment <= segments; segment += 1) {
        const drift = randomRange(-0.28, 0.28);
        const distance = (length / segments) * segment;
        points.push({
          x: centerX + Math.cos(angle + drift) * distance,
          y: centerY + Math.sin(angle + drift) * distance,
        });
      }
      this.cracks.push({ x: centerX, y: centerY, points, alpha: Math.min(0.95, 0.42 + intensity * 0.32) });
    }
  }

  cameraOffset(): Vec2 {
    if (this.shake <= 0.001) {
      return vec2(0, 0);
    }
    const magnitude = this.shake * this.shake * 0.16;
    return vec2(randomRange(-magnitude, magnitude), randomRange(-magnitude, magnitude));
  }

  spawnSlash(position: Vec2, facing: number, combo: number): void {
    const color = combo === 2 ? 0xe6fbff : combo === 1 ? 0x9beeff : 0xffffff;
    const radius = 2.2 + combo * 0.46;
    const arc = Math.PI * (0.62 + combo * 0.11);
    const start = facing - arc * 0.5;
    const end = facing + arc * 0.5;

    for (let i = 0; i < 3; i += 1) {
      const geometry = createArcGeometry(radius + i * 0.22, 0.2 + i * 0.055, start, end, 48);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95 - i * 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(position.x, 0.15 + i * 0.015, position.y);
      mesh.renderOrder = 35 + i;
      this.scene.add(mesh);
      this.timed.push({
        mesh,
        ttl: 0.34 + i * 0.055,
        age: 0,
        startScale: 0.64,
        endScale: 1.24 + combo * 0.09,
        startOpacity: material.opacity,
        spin: 0,
        velocity: vec2(0, 0),
      });

      const slashTexture = createSlashSpriteTexture(color, combo, i);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: slashTexture,
        transparent: true,
        opacity: 0.92 - i * 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      spriteMaterial.rotation = -facing;
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(position.x, 0.8 + i * 0.02, position.y);
      const spriteScale = (radius + i * 0.32) * (2.25 + combo * 0.08);
      sprite.scale.set(spriteScale, spriteScale, 1);
      sprite.renderOrder = 70 + i;
      this.scene.add(sprite);
      this.timed.push({
        mesh: sprite,
        ttl: 0.72 + i * 0.06,
        age: 0,
        startScale: spriteScale * 0.82,
        endScale: spriteScale * (1.18 + combo * 0.1),
        startOpacity: spriteMaterial.opacity,
        spin: 0,
        velocity: vec2(0, 0),
      });

      const planeMaterial = new THREE.MeshBasicMaterial({
        map: slashTexture,
        transparent: true,
        opacity: 0.9 - i * 0.12,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), planeMaterial);
      plane.rotation.x = -Math.PI * 0.5;
      plane.rotation.z = facing;
      plane.position.set(position.x, 1.0 + i * 0.02, position.y);
      plane.renderOrder = 85 + i;
      this.scene.add(plane);
      this.timed.push({
        mesh: plane,
        ttl: 0.72 + i * 0.06,
        age: 0,
        startScale: spriteScale * 0.78,
        endScale: spriteScale * (1.12 + combo * 0.08),
        startOpacity: planeMaterial.opacity,
        spin: 0,
        velocity: vec2(0, 0),
      });
    }
  }

  spawnShockwave(position: Vec2, radius: number, color = 0x9deeff, ttl = 0.62): void {
    const geometry = new THREE.RingGeometry(0.96, 1.04, 72);
    geometry.rotateX(-Math.PI * 0.5);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.68,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(position.x, 0.13, position.y);
    mesh.renderOrder = 30;
    this.scene.add(mesh);
    this.timed.push({
      mesh,
      ttl,
      age: 0,
      startScale: 0.2,
      endScale: radius,
      startOpacity: material.opacity,
      spin: 0,
      velocity: vec2(0, 0),
    });
  }

  spawnCrackDecal(position: Vec2, texture: THREE.Texture, scale = 2.2): void {
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity: 0.78,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
    mesh.rotation.x = -Math.PI * 0.5;
    mesh.rotation.z = randomRange(0, Math.PI * 2);
    mesh.position.set(position.x, 0.045, position.y);
    mesh.renderOrder = 8;
    this.scene.add(mesh);
    this.timed.push({
      mesh,
      ttl: 4.2,
      age: 0,
      startScale: scale,
      endScale: scale * 1.04,
      startOpacity: material.opacity,
      spin: 0,
      velocity: vec2(0, 0),
    });
  }

  spawnParticles(
    position: Vec2,
    count: number,
    palette: readonly number[],
    force = 1,
    directionalAngle?: number,
  ): void {
    for (let i = 0; i < count; i += 1) {
      const color = palette[Math.floor(Math.random() * palette.length)];
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: randomRange(0.55, 0.95),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(particleGeometry, material);
      mesh.rotation.x = -Math.PI * 0.5;
      mesh.rotation.z = randomRange(0, Math.PI);
      mesh.position.set(position.x + randomRange(-0.24, 0.24), 0.2, position.y + randomRange(-0.24, 0.24));
      mesh.renderOrder = 38;
      this.scene.add(mesh);

      const angle = directionalAngle ?? randomRange(-Math.PI, Math.PI);
      const spread = directionalAngle === undefined ? 0 : randomRange(-0.7, 0.7);
      const direction = vecFromAngle(angle + spread);
      const speed = randomRange(1.5, 7.5) * force;
      this.timed.push({
        mesh,
        ttl: randomRange(0.24, 0.62),
        age: 0,
        startScale: randomRange(0.06, 0.16),
        endScale: randomRange(0.02, 0.05),
        startOpacity: material.opacity,
        spin: randomRange(-7, 7),
        velocity: vec2(direction.x * speed, direction.y * speed),
      });
    }
  }

  private resizeCanvas(): void {
    const rect = this.root.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    this.crackCanvas.width = Math.max(1, Math.floor(rect.width * ratio));
    this.crackCanvas.height = Math.max(1, Math.floor(rect.height * ratio));
    this.crackCanvas.style.width = `${rect.width}px`;
    this.crackCanvas.style.height = `${rect.height}px`;
  }

  private drawScreenCracks(): void {
    const context = this.crackContext;
    const width = this.crackCanvas.width;
    const height = this.crackCanvas.height;
    context.clearRect(0, 0, width, height);

    for (let index = this.cracks.length - 1; index >= 0; index -= 1) {
      const crack = this.cracks[index];
      crack.alpha -= 0.018;
      if (crack.alpha <= 0) {
        this.cracks.splice(index, 1);
        continue;
      }
      context.save();
      context.globalAlpha = crack.alpha * Math.max(0, Math.min(1, this.smash + 0.55));
      context.strokeStyle = '#e8f8ff';
      context.lineWidth = Math.max(1, width / 1200);
      context.shadowColor = '#91dbff';
      context.shadowBlur = 8;
      context.beginPath();
      const [first, ...rest] = crack.points;
      context.moveTo(first.x, first.y);
      rest.forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
      context.restore();
    }
  }
}

function createArcGeometry(
  radius: number,
  thickness: number,
  startAngle: number,
  endAngle: number,
  segments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    const inner = radius - thickness;
    const outer = radius + thickness;
    positions.push(Math.cos(angle) * inner, 0, Math.sin(angle) * inner);
    positions.push(Math.cos(angle) * outer, 0, Math.sin(angle) * outer);
  }

  for (let i = 0; i < segments; i += 1) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createSlashSpriteTexture(color: number, combo: number, layer: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create slash texture.');
  }
  const cssColor = `#${color.toString(16).padStart(6, '0')}`;
  context.clearRect(0, 0, 256, 256);
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.shadowColor = cssColor;
  context.shadowBlur = 12 + combo * 5;
  context.strokeStyle = cssColor;
  context.globalAlpha = 0.9 - layer * 0.12;
  context.lineWidth = 15 - layer * 3;
  const arc = Math.PI * (0.62 + combo * 0.11);
  context.beginPath();
  context.arc(128, 128, 74 + layer * 14, -arc * 0.5, arc * 0.5);
  context.stroke();
  context.globalAlpha = 0.5;
  context.lineWidth = 5;
  context.beginPath();
  context.arc(128, 128, 92 + layer * 12, -arc * 0.45, arc * 0.45);
  context.stroke();
  context.fillStyle = cssColor;
  for (let i = 0; i < 18 + combo * 8; i += 1) {
    const angle = randomRange(-arc * 0.52, arc * 0.52);
    const radius = randomRange(58, 116);
    const size = randomRange(1.5, 4.5);
    context.globalAlpha = randomRange(0.35, 0.9);
    context.fillRect(128 + Math.cos(angle) * radius, 128 + Math.sin(angle) * radius, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function materialOf(object: THREE.Object3D): THREE.Material | undefined {
  const maybeMesh = object as THREE.Mesh;
  const material = maybeMesh.material;
  if (Array.isArray(material)) {
    return material[0];
  }
  return material;
}

function disposeObject(object: THREE.Object3D): void {
  const maybeMesh = object as THREE.Mesh;
  maybeMesh.geometry?.dispose();
  const material = maybeMesh.material;
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
  } else {
    material?.dispose();
  }
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}
