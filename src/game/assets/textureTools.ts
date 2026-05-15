import * as THREE from 'three';

export type AtlasFrame = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type CropOptions = {
  transparentBackground?: boolean;
  threshold?: number;
  feather?: number;
  padding?: number;
  sourcePadding?: number;
  trimTransparent?: boolean;
  trimPadding?: number;
  removeIsolatedAlpha?: boolean;
  isolatedAlphaMinPixels?: number;
};

export function prepareTexture(texture: THREE.Texture): THREE.Texture {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

export function textureAspect(texture: THREE.Texture | null | undefined): number {
  const image = texture?.image as
    | undefined
    | {
        width?: number;
        height?: number;
        naturalWidth?: number;
        naturalHeight?: number;
      };
  const width = image?.width ?? image?.naturalWidth ?? 1;
  const height = image?.height ?? image?.naturalHeight ?? 1;
  return Math.max(0.2, width / Math.max(1, height));
}

export function scaleSpriteToTexture(sprite: THREE.Sprite, height: number, facingSign = 1): void {
  const material = sprite.material as THREE.SpriteMaterial;
  sprite.scale.set(height * textureAspect(material.map) * facingSign, height, 1);
}

export function cropTexture(
  source: THREE.Texture,
  frame: AtlasFrame,
  options: CropOptions = {},
): THREE.CanvasTexture {
  const padding = options.padding ?? 0;
  const sourcePadding = options.sourcePadding ?? 0;
  const image = source.image as CanvasImageSource & { naturalWidth: number; naturalHeight: number };
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  const wantedX = frame.x - sourcePadding;
  const wantedY = frame.y - sourcePadding;
  const wantedWidth = frame.w + padding * 2;
  const wantedHeight = frame.h + padding * 2;
  const sourceX = Math.max(0, wantedX);
  const sourceY = Math.max(0, wantedY);
  const sourceRight = Math.min(Number(sourceWidth), frame.x + frame.w + sourcePadding);
  const sourceBottom = Math.min(Number(sourceHeight), frame.y + frame.h + sourcePadding);
  const sourceCropWidth = Math.max(1, sourceRight - sourceX);
  const sourceCropHeight = Math.max(1, sourceBottom - sourceY);
  const destX = padding - sourcePadding + (sourceX - wantedX);
  const destY = padding - sourcePadding + (sourceY - wantedY);

  let canvas = document.createElement('canvas');
  canvas.width = wantedWidth;
  canvas.height = wantedHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Could not allocate 2D canvas context for texture crop.');
  }

  context.imageSmoothingEnabled = false;
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceCropWidth,
    sourceCropHeight,
    destX,
    destY,
    sourceCropWidth,
    sourceCropHeight,
  );

  if (options.transparentBackground) {
    keyOutBackground(context, canvas.width, canvas.height, options.threshold ?? 24, options.feather ?? 12);
  }

  if (options.removeIsolatedAlpha) {
    removeSmallAlphaComponents(context, canvas.width, canvas.height, options.isolatedAlphaMinPixels ?? 24);
  }

  if (options.trimTransparent) {
    canvas = trimTransparentPixels(canvas, options.trimPadding ?? 4);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function trimTransparentPixels(source: HTMLCanvasElement, trimPadding: number): HTMLCanvasElement {
  const sourceContext = source.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) {
    return source;
  }

  const image = sourceContext.getImageData(0, 0, source.width, source.height);
  const bounds = findOpaqueBounds(image.data, source.width, source.height);
  const left = Math.max(0, bounds.left - trimPadding);
  const top = Math.max(0, bounds.top - trimPadding);
  const right = Math.min(source.width - 1, bounds.right + trimPadding);
  const bottom = Math.min(source.height - 1, bounds.bottom + trimPadding);
  const width = Math.max(1, right - left + 1);
  const height = Math.max(1, bottom - top + 1);

  if (left === 0 && top === 0 && width === source.width && height === source.height) {
    return source;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return source;
  }
  context.imageSmoothingEnabled = false;
  context.drawImage(source, left, top, width, height, 0, 0, width, height);
  return canvas;
}

function removeSmallAlphaComponents(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  minPixels: number,
): void {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const visited = new Uint8Array(width * height);
  const queue: number[] = [];
  const component: number[] = [];

  for (let pixel = 0; pixel < visited.length; pixel += 1) {
    if (visited[pixel] || data[pixel * 4 + 3] <= 24) {
      continue;
    }

    queue.length = 0;
    component.length = 0;
    visited[pixel] = 1;
    queue.push(pixel);
    let head = 0;

    while (head < queue.length) {
      const current = queue[head];
      head += 1;
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      const neighbors = [
        current - 1,
        current + 1,
        current - width,
        current + width,
      ];

      for (const next of neighbors) {
        const nextX = next % width;
        if (
          next < 0 ||
          next >= visited.length ||
          visited[next] ||
          Math.abs(nextX - x) > 1 ||
          Math.abs(Math.floor(next / width) - y) > 1 ||
          data[next * 4 + 3] <= 24
        ) {
          continue;
        }
        visited[next] = 1;
        queue.push(next);
      }
    }

    if (component.length >= minPixels) {
      continue;
    }

    for (const smallPixel of component) {
      data[smallPixel * 4 + 3] = 0;
    }
  }

  context.putImageData(image, 0, 0);
}

function keyOutBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  threshold: number,
  feather: number,
): void {
  const image = context.getImageData(0, 0, width, height);
  const data = image.data;
  const bounds = findOpaqueBounds(data, width, height);
  const profile = buildBackgroundProfile(data, width, bounds);
  const transparent = floodBackground(data, width, bounds, profile, threshold + feather);
  expandSoftBackgroundEdge(data, width, bounds, transparent, profile, threshold, feather);
  for (let pixel = 0; pixel < transparent.length; pixel += 1) {
    if (!transparent[pixel]) {
      continue;
    }
    const index = pixel * 4;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    const distance = matteDistance(data, index, expectedBackground(profile, x, y));
    if (distance < threshold) {
      data[index + 3] = 0;
    } else {
      data[index + 3] = Math.round(data[index + 3] * ((distance - threshold) / Math.max(1, feather)));
    }
  }

  context.putImageData(image, 0, 0);
}

type BackgroundProfile = {
  bounds: { left: number; right: number; top: number; bottom: number };
  top: number[][];
  bottom: number[][];
  left: number[][];
  right: number[][];
};

function buildBackgroundProfile(
  data: Uint8ClampedArray,
  width: number,
  bounds: { left: number; right: number; top: number; bottom: number },
): BackgroundProfile {
  const top: number[][] = [];
  const bottom: number[][] = [];
  const left: number[][] = [];
  const right: number[][] = [];

  for (let x = bounds.left; x <= bounds.right; x += 1) {
    top[x] = smoothEdgeSample(data, width, x, bounds.top, 1, 0, bounds);
    bottom[x] = smoothEdgeSample(data, width, x, bounds.bottom, -1, 0, bounds);
  }
  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    left[y] = smoothEdgeSample(data, width, bounds.left, y, 0, 1, bounds);
    right[y] = smoothEdgeSample(data, width, bounds.right, y, 0, -1, bounds);
  }

  return { bounds, top, bottom, left, right };
}

function smoothEdgeSample(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  inwardX: number,
  inwardY: number,
  bounds: { left: number; right: number; top: number; bottom: number },
): number[] {
  const samples: number[][] = [];
  for (let offset = -2; offset <= 2; offset += 1) {
    for (let depth = 0; depth <= 2; depth += 1) {
      const sampleX = clampInt(x + (inwardY === 0 ? offset : inwardX * depth), bounds.left, bounds.right);
      const sampleY = clampInt(y + (inwardX === 0 ? offset : inwardY * depth), bounds.top, bounds.bottom);
      const index = (sampleY * width + sampleX) * 4;
      if (data[index + 3] > 10) {
        samples.push([data[index], data[index + 1], data[index + 2]]);
      }
    }
  }
  samples.sort((a, b) => luminance(a[0], a[1], a[2]) - luminance(b[0], b[1], b[2]));
  return samples[Math.floor(samples.length * 0.4)] ?? [0, 0, 0];
}

function floodBackground(
  data: Uint8ClampedArray,
  width: number,
  bounds: { left: number; right: number; top: number; bottom: number },
  profile: BackgroundProfile,
  maxDistance: number,
): Uint8Array {
  const transparent = new Uint8Array(data.length / 4);
  const queue: number[] = [];
  let head = 0;
  const edgeGuard = Math.max(18, Math.min(34, maxDistance * 0.38));
  const enqueue = (x: number, y: number) => {
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) {
      return;
    }
    const pixel = y * width + x;
    const index = pixel * 4;
    if (
      transparent[pixel] ||
      data[index + 3] <= 10 ||
      matteDistance(data, index, expectedBackground(profile, x, y)) > maxDistance ||
      localContrast(data, width, x, y, bounds) > edgeGuard
    ) {
      return;
    }
    transparent[pixel] = 1;
    queue.push(pixel);
  };

  for (let x = bounds.left; x <= bounds.right; x += 1) {
    enqueue(x, bounds.top);
    enqueue(x, bounds.bottom);
  }
  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    enqueue(bounds.left, y);
    enqueue(bounds.right, y);
  }

  while (head < queue.length) {
    const pixel = queue[head];
    head += 1;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    enqueue(x + 1, y);
    enqueue(x - 1, y);
    enqueue(x, y + 1);
    enqueue(x, y - 1);
  }

  return transparent;
}

function expandSoftBackgroundEdge(
  data: Uint8ClampedArray,
  width: number,
  bounds: { left: number; right: number; top: number; bottom: number },
  transparent: Uint8Array,
  profile: BackgroundProfile,
  threshold: number,
  feather: number,
): void {
  const maxDistance = threshold + feather * 0.48;
  const edgeGuard = Math.max(20, Math.min(38, (threshold + feather) * 0.45));
  const candidates: number[] = [];

  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      const pixel = y * width + x;
      if (transparent[pixel]) {
        continue;
      }
      const index = pixel * 4;
      const expected = expectedBackground(profile, x, y);
      if (
        data[index + 3] <= 10 ||
        matteDistance(data, index, expected) > maxDistance ||
        localContrast(data, width, x, y, bounds) > edgeGuard ||
        !hasTransparentNeighbor(transparent, width, x, y, bounds)
      ) {
        continue;
      }
      candidates.push(pixel);
    }
  }

  candidates.forEach((pixel) => {
    transparent[pixel] = 1;
  });
}

function expectedBackground(profile: BackgroundProfile, x: number, y: number): number[] {
  const { bounds } = profile;
  const widthSpan = Math.max(1, bounds.right - bounds.left);
  const heightSpan = Math.max(1, bounds.bottom - bounds.top);
  const leftWeight = Math.max(0.01, 1 - (x - bounds.left) / widthSpan);
  const rightWeight = Math.max(0.01, 1 - (bounds.right - x) / widthSpan);
  const topWeight = Math.max(0.01, 1 - (y - bounds.top) / heightSpan);
  const bottomWeight = Math.max(0.01, 1 - (bounds.bottom - y) / heightSpan);
  const samples = [
    { color: profile.top[x] ?? profile.top[bounds.left], weight: topWeight },
    { color: profile.bottom[x] ?? profile.bottom[bounds.left], weight: bottomWeight },
    { color: profile.left[y] ?? profile.left[bounds.top], weight: leftWeight },
    { color: profile.right[y] ?? profile.right[bounds.top], weight: rightWeight },
  ];
  const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
  return [0, 1, 2].map((channel) =>
    samples.reduce((sum, sample) => sum + sample.color[channel] * sample.weight, 0) / totalWeight,
  );
}

function matteDistance(data: Uint8ClampedArray, index: number, expected: number[]): number {
  const colorDelta = colorDistance(data, index, expected);
  const lumaDelta = Math.abs(luminance(data[index], data[index + 1], data[index + 2]) - luminance(expected[0], expected[1], expected[2]));
  return colorDelta * 0.78 + lumaDelta * 0.22;
}

function hasTransparentNeighbor(
  transparent: Uint8Array,
  width: number,
  x: number,
  y: number,
  bounds: { left: number; right: number; top: number; bottom: number },
): boolean {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) {
        continue;
      }
      const neighborX = x + offsetX;
      const neighborY = y + offsetY;
      if (
        neighborX < bounds.left ||
        neighborX > bounds.right ||
        neighborY < bounds.top ||
        neighborY > bounds.bottom
      ) {
        continue;
      }
      if (transparent[neighborY * width + neighborX]) {
        return true;
      }
    }
  }
  return false;
}

function colorDistance(data: Uint8ClampedArray, index: number, key: number[]): number {
  return Math.hypot(data[index] - key[0], data[index + 1] - key[1], data[index + 2] - key[2]);
}

function luminance(r: number, g: number, b: number): number {
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

function localContrast(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  bounds: { left: number; right: number; top: number; bottom: number },
): number {
  const index = (y * width + x) * 4;
  let contrast = 0;
  const neighbors = [
    [x + 1, y],
    [x - 1, y],
    [x, y + 1],
    [x, y - 1],
  ];

  for (const [neighborX, neighborY] of neighbors) {
    if (
      neighborX < bounds.left ||
      neighborX > bounds.right ||
      neighborY < bounds.top ||
      neighborY > bounds.bottom
    ) {
      continue;
    }
    const neighborIndex = (neighborY * width + neighborX) * 4;
    if (data[neighborIndex + 3] <= 10) {
      continue;
    }
    contrast = Math.max(contrast, colorDistance(data, neighborIndex, [data[index], data[index + 1], data[index + 2]]));
  }

  return contrast;
}

function findOpaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { left: number; right: number; top: number; bottom: number } {
  let left = width - 1;
  let right = 0;
  let top = height - 1;
  let bottom = 0;
  let found = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha <= 10) {
        continue;
      }
      found = true;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  return found ? { left, right, top, bottom } : { left: 0, right: width - 1, top: 0, bottom: height - 1 };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function makeSpriteMaterial(texture: THREE.Texture, opacity = 1): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.03,
    opacity,
    depthWrite: false,
  });
}
